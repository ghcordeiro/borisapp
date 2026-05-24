# boris.app — Master Spec

> Documento de referência para implementação do produto. Autocontido: uma IA ou desenvolvedor sem contexto anterior deve conseguir implementar tudo a partir deste arquivo.

---

## 1. Visão geral do produto

**boris.app** é um SaaS de cuidado intensivo de felinos, focado inicialmente em filhotes. O nome vem do Boris, um Persian de 60 dias de vida do fundador.

**Proposta de valor central:** o tutor confirma com um toque que o pet comeu, vê o histórico de peso crescendo semana a semana, e tem um plano calórico gerado automaticamente por fórmulas veterinárias.

**Usuário-alvo (persona):** dono de gato, especialmente filhote, preocupado com nutrição e crescimento saudável. Usa o app diariamente para registrar refeições e pesar o pet.

---

## 2. Stack tecnológica (imutável — não alterar)

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 — App Router |
| Linguagem | TypeScript (strict mode) |
| Estilização | Tailwind CSS + Shadcn UI (tema violet/purple) |
| Gráficos | Recharts |
| Banco | PostgreSQL via Neon |
| ORM | Prisma 6 |
| Auth | NextAuth.js v5 (Auth.js) — Google + GitHub OAuth |
| Deploy | Vercel |
| Datas | date-fns + ptBR locale |
| Validação | Zod em todas as Server Actions |
| Notificações | Sonner (toast) |

---

## 3. Estado atual do codebase

### 3.1 Estrutura de diretórios (já existe)

```
boris.app/
├── app/
│   ├── page.tsx                          # Redirect → /dashboard
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Auth guard + Sidebar + Header
│   │   ├── dashboard/page.tsx            # Grid de PetCards
│   │   └── pets/
│   │       ├── new/page.tsx              # Formulário de criação de pet
│   │       └── [petId]/page.tsx          # Página principal do pet (tabs)
│   └── api/auth/[...nextauth]/route.ts
├── components/
│   ├── auth/login-form.tsx
│   ├── dashboard/sidebar.tsx + header.tsx
│   ├── pets/pet-card.tsx + empty-pets.tsx
│   ├── tracker/
│   │   ├── weight-chart.tsx              # Recharts LineChart
│   │   └── log-weight-form.tsx           # Formulário expand/collapse
│   ├── nutrition/
│   │   ├── nutrition-summary.tsx         # Resumo completo do plano ativo
│   │   ├── create-diet-plan-form.tsx     # Com preview calórico em tempo real
│   │   └── add-diet-item-form.tsx        # Com cálculo de gramas ao vivo
│   └── health/
│       ├── health-log-list.tsx
│       └── add-health-log-form.tsx
├── lib/
│   ├── auth.ts + auth.config.ts + middleware.ts
│   ├── db/client.ts + pets.ts            # Queries + serializePet()
│   ├── nutrition/formulas.ts             # RER/NED + distributeMeals()
│   └── actions/
│       ├── pets.actions.ts               # createPet, updatePet, logWeight, deletePet
│       ├── nutrition.actions.ts          # createDietPlan, addDietItem, previewNutritionPlan
│       └── health.actions.ts             # addHealthLog
└── prisma/schema.prisma
```

### 3.2 Schema Prisma atual (estado real)

```prisma
// Modelos de Auth (NextAuth) — NÃO TOCAR
model User { id, name, email, accounts[], sessions[], pets[], mealLogs[] }
model Account { ... }
model Session { ... }
model VerificationToken { ... }

// Domínio — EXISTENTES
model Pet {
  id, userId, name, breed?, birthDate?, gender(Gender)?, imageUrl?,
  isActive(true), notes?, createdAt, updatedAt
  // Relations:
  user User, weightLogs WeightLog[], dietPlans DietPlan[],
  healthLogs HealthLog[], vetAppointments VetAppointment[], dewormings Deworming[]
}

model WeightLog {
  id, petId, weightKg(Decimal 5,3), loggedAt(default now), notes?
}

model DietPlan {
  id, petId,
  weightKg(Decimal 5,3),   // peso usado no cálculo
  rerKcal(Decimal 8,2),    // RER = 70 × (kg^0.75)
  nedKcal(Decimal 8,2),    // NED = RER × energyFactor
  energyFactor(Decimal 4,2, default 1.60),
  mealsPerDay(Int, default 4),
  isActive(Boolean, default true),
  wakeTime(String?),       // "HH:MM" — acordar do tutor
  sleepTime(String?),      // "HH:MM" — dormir do tutor
  notes?, createdAt, updatedAt
  // Relations: pet Pet, dietItems DietItem[]
}

model DietItem {
  id, dietPlanId, name, type(DietItemType),
  kcalPer100g(Decimal 7,2), dailyGrams(Decimal 7,2),
  notes?, createdAt, updatedAt
}

model HealthLog {
  id, petId, type(HealthLogType), description,
  severity(Severity, default LOW), occurredAt(default now),
  resolvedAt?, notes?, createdAt, updatedAt
}

model Deworming {
  id, petId, product, doseMg(Decimal 6,2)?, appliedAt, nextDueAt?, notes?
}

model VetAppointment {
  id, petId, title, vetName?, clinicName?,
  scheduledAt, completedAt?, status(AppointmentStatus, default SCHEDULED),
  notes?, createdAt, updatedAt
}

// Enums existentes
enum Gender { MALE, FEMALE, UNKNOWN }
enum DietItemType { KIBBLE, WET_FOOD, SUPPLEMENT, TREAT, OTHER }
enum HealthLogType { SYMPTOM, MEDICATION, OBSERVATION, EMERGENCY }
enum Severity { LOW, MEDIUM, HIGH, CRITICAL }
enum AppointmentStatus { SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED }
```

### 3.3 Padrão crítico: serialização de Decimal do Prisma

**PROBLEMA:** `Decimal` do Prisma não pode ser passado para Client Components — Next.js lança erro de serialização.

**SOLUÇÃO DEFINITIVA** (já implementada em `lib/db/pets.ts`):

```typescript
// Usar JSON roundtrip — Decimal.toJSON() retorna string
const raw = JSON.parse(JSON.stringify(prismaObject))
// Depois converter strings numéricas de volta para number:
weightKg: parseFloat(raw.weightKg)
```

**REGRA:** todo modelo com campo `Decimal` que for passado a Client Components DEVE passar por `JSON.parse(JSON.stringify())` e ter os campos convertidos com `parseFloat()`. Aplicar o mesmo padrão de `serializePet()` em `lib/db/pets.ts`.

### 3.4 Padrão de autenticação

```typescript
// Em Server Components e Server Actions:
const session = await auth()
if (!session?.user?.id) return { error: "Não autenticado" }
// NUNCA usar session!.user.id (TypeScript TS2532)
// SEMPRE usar session?.user?.id ?? ""
```

### 3.5 Padrão de Server Actions

```typescript
"use server"
// 1. auth() obrigatório
// 2. Zod schema.safeParse() obrigatório
// 3. Verificar ownership (pet pertence ao userId)
// 4. revalidatePath() após mutação
// 5. Retornar { data } | { error }
```

### 3.6 Workarounds temporários pendentes de remoção

Após rodar `npx prisma generate` (que ainda não foi executado após a migração `add_tutor_routine`):

| Arquivo | Workaround | O que fazer |
|---|---|---|
| `lib/actions/nutrition.actions.ts` linha 94 | `(prisma.dietPlan.create as Function)({...})` | Voltar para tipagem normal |
| `components/nutrition/nutrition-summary.tsx` linha 23 | `const p = plan as typeof plan & { wakeTime?: string \| null; sleepTime?: string \| null }` | Remover o cast, usar `plan.wakeTime` diretamente |

---

## 4. Fases de implementação

### Contexto das fases

| Fase | Feature | Status |
|---|---|---|
| 0 | Core MVP (pet, peso, nutrição, saúde) | ✅ Concluído |
| 1 | MealLog + Tela de Status do Dia | 🔴 Pendente |
| 2 | Family Sync (convite familiar) | 🔴 Pendente |
| 3 | Saúde completa (VetAppointment UI, Deworming UI, Vaccines) | 🔴 Pendente |
| 4 | Água + Dashboard de métricas | 🔴 Pendente |

---

## 5. Fase 1 — MealLog + Tela de Status do Dia

### Objetivo

O tutor vê, na página do pet, uma tela de "hoje" mostrando cada refeição planejada. Um botão grande "✓ Dei agora" registra a refeição. A tela mostra progresso do dia e "última vez que o Boris comeu: há X min".

### 5.1 Migração de banco

**Arquivo:** `prisma/schema.prisma`

Adicionar modelo `MealLog` e as relações nos modelos existentes:

```prisma
model MealLog {
  id             String   @id @default(cuid())
  petId          String
  dietPlanId     String
  mealNumber     Int                         // Qual refeição do dia: 1, 2, 3, 4...
  scheduledTime  String                      // Horário planejado: "12:00"
  servedAt       DateTime @default(now())    // Timestamp real de quando foi servido
  servedByUserId String
  plannedGrams   Decimal  @db.Decimal(7, 2)  // Soma de dailyGrams ÷ mealsPerDay
  actualGrams    Decimal? @db.Decimal(7, 2)  // Gramas realmente servidas (opcional)
  notes          String?  @db.Text
  createdAt      DateTime @default(now())

  pet      Pet      @relation(fields: [petId], references: [id], onDelete: Cascade)
  dietPlan DietPlan @relation(fields: [dietPlanId], references: [id])
  servedBy User     @relation(fields: [servedByUserId], references: [id])

  @@index([petId, servedAt])
  @@index([petId, dietPlanId, servedAt])
  @@map("meal_logs")
}
```

Adicionar relações nos modelos existentes:

```prisma
// Em model Pet:
mealLogs MealLog[]

// Em model DietPlan:
mealLogs MealLog[]

// Em model User:
mealLogs MealLog[]
```

Comandos para rodar (na ordem):
```bash
# Só se ainda não rodou add_tutor_routine nesta máquina:
npx prisma migrate dev --name add_tutor_routine

# Migração principal:
npx prisma migrate dev --name add_meal_log
npx prisma generate
```

### 5.2 Atualizar `lib/db/pets.ts`

**Calcular "hoje"** no topo da função `getPetById`:

```typescript
const startOfToday = new Date()
startOfToday.setHours(0, 0, 0, 0)
const startOfTomorrow = new Date(startOfToday)
startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
```

**ATENÇÃO:** não usar `toISOString().slice(0,10)` — quebra em fusos ≠ UTC.

Adicionar ao `include` de `getPetById`:

```typescript
mealLogs: {
  where: {
    servedAt: { gte: startOfToday, lt: startOfTomorrow },
  },
  orderBy: { servedAt: "desc" },
  include: {
    servedBy: { select: { name: true } },
  },
},
```

Estender o tipo `raw` em `serializePet()`:

```typescript
// Adicionar ao tipo raw:
mealLogs: Array<{
  id: string
  petId: string
  dietPlanId: string
  mealNumber: number
  scheduledTime: string
  servedAt: string
  servedByUserId: string
  plannedGrams: string    // Decimal → string via JSON
  actualGrams: string | null
  notes: string | null
  createdAt: string
  servedBy: { name: string | null }
}>

// Adicionar ao return de serializePet():
mealLogs: raw.mealLogs.map((ml) => ({
  ...ml,
  plannedGrams: parseFloat(ml.plannedGrams),
  actualGrams: ml.actualGrams ? parseFloat(ml.actualGrams) : null,
})),
```

### 5.3 Criar `lib/actions/meals.actions.ts`

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"

// ── logMeal ──────────────────────────────────────────────────────────────────

const LogMealSchema = z.object({
  petId: z.string().cuid(),
  dietPlanId: z.string().cuid(),
  mealNumber: z.number().int().min(1).max(6),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  plannedGrams: z.number().positive(),
  actualGrams: z.number().positive().optional(),
  notes: z.string().optional(),
})

export async function logMeal(formData: z.infer<typeof LogMealSchema>) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Não autenticado" }

  const parsed = LogMealSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { petId, dietPlanId, mealNumber, scheduledTime, plannedGrams, actualGrams, notes } = parsed.data

  // Verificar ownership
  const pet = await prisma.pet.findUnique({ where: { id: petId, userId: session.user.id } })
  if (!pet) return { error: "Pet não encontrado" }

  // Idempotência: no máximo 1 MealLog por (petId, mealNumber) por dia civil
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const existing = await prisma.mealLog.findFirst({
    where: { petId, mealNumber, servedAt: { gte: today, lt: tomorrow } },
  })
  if (existing) return { error: "Refeição já registrada hoje" }

  const mealLog = await prisma.mealLog.create({
    data: { petId, dietPlanId, mealNumber, scheduledTime, plannedGrams, actualGrams, notes, servedByUserId: session.user.id },
  })

  revalidatePath(`/pets/${petId}`)
  return { data: mealLog }
}
```

### 5.4 Criar `components/tracker/daily-status-screen.tsx`

Este é o componente principal. É um `"use client"`.

**Props:**
```typescript
interface DailyStatusScreenProps {
  pet: SerializedPet  // pet.dietPlans[0] é o plano ativo; pet.mealLogs são os do dia
}
```

**Lógica de status por refeição:**
```typescript
type MealStatus = "upcoming" | "due" | "served" | "missed"

function getMealStatus(scheduledTime: string, servedAt: string | null): MealStatus {
  if (servedAt) return "served"
  
  const now = new Date()
  const [h, m] = scheduledTime.split(":").map(Number)
  const scheduled = new Date()
  scheduled.setHours(h, m, 0, 0)
  
  const diffMin = (now.getTime() - scheduled.getTime()) / 60000
  if (diffMin < 0) return "upcoming"
  if (diffMin <= 60) return "due"
  return "missed"
}
```

**Cálculo de plannedGrams por refeição:**
```typescript
// Soma de dailyGrams de todos os DietItems ÷ mealsPerDay
const totalDailyGrams = plan.dietItems.reduce((s, i) => s + i.dailyGrams, 0)
const gramsPerMeal = Math.round((totalDailyGrams / plan.mealsPerDay) * 10) / 10
```

**Horários das refeições:**
```typescript
import { distributeMeals } from "@/lib/nutrition/formulas"
const meals = distributeMeals(plan.nedKcal, plan.mealsPerDay, plan.wakeTime ?? undefined, plan.sleepTime ?? undefined)
```

**Layout visual por status:**

| Status | Visual |
|---|---|
| `served` | Borda verde, ✅, "Servido às HH:MM por Nome" |
| `due` | Borda primary (violet), ⏰, botão grande "✓ Dei agora" |
| `missed` | Borda vermelha/laranja, ⚠️, botão menor "Registrar mesmo assim" |
| `upcoming` | Borda dashed muted, 🔜, horário planejado |

**Handler do botão:**
```typescript
const [loadingMeal, setLoadingMeal] = useState<number | null>(null)

async function handleServe(mealNumber: number, scheduledTime: string) {
  setLoadingMeal(mealNumber)
  const result = await logMeal({
    petId: pet.id,
    dietPlanId: plan.id,
    mealNumber,
    scheduledTime,
    plannedGrams: gramsPerMeal,
  })
  if ("error" in result) toast.error(result.error as string)
  else toast.success("✅ Refeição registrada!")
  setLoadingMeal(null)
}
```

**Ícones de refeição:** `["🌅", "☀️", "🌤️", "🌆", "🌙", "⭐"]` (mesmo padrão de `nutrition-summary.tsx`)

**Footer — "última refeição":**
```typescript
const lastServed = pet.mealLogs[0]  // já vem ordenado desc
const minutesSince = lastServed
  ? Math.round((Date.now() - new Date(lastServed.servedAt).getTime()) / 60000)
  : null
```

### 5.5 Atualizar `app/(dashboard)/pets/[petId]/page.tsx`

Adicionar import do novo componente:
```typescript
import { DailyStatusScreen } from "@/components/tracker/daily-status-screen"
```

Inserir **antes** do `<Tabs>`, só quando houver plano ativo:
```tsx
{activePlan && (
  <DailyStatusScreen pet={serialized} />
)}
```

### 5.6 Remover workarounds temporários

Após `npx prisma generate`:

**`lib/actions/nutrition.actions.ts` linha 94:**
```typescript
// ANTES (workaround):
const dietPlan = await (prisma.dietPlan.create as Function)({ data: { ... } })

// DEPOIS (tipagem normal):
const dietPlan = await prisma.dietPlan.create({ data: { ... } })
```

**`components/nutrition/nutrition-summary.tsx` linha 23:**
```typescript
// ANTES (workaround):
const p = plan as typeof plan & { wakeTime?: string | null; sleepTime?: string | null }
// ... usando p.wakeTime, p.sleepTime

// DEPOIS: usar plan.wakeTime e plan.sleepTime diretamente (campos tipados após generate)
```

### 5.7 Critérios de aceite — Fase 1

- [ ] `npx tsc --noEmit` passa sem erros
- [ ] Tabela `meal_logs` existe no banco após `prisma migrate dev`
- [ ] Clicar "✓ Dei agora" cria MealLog no banco com timestamp real
- [ ] Clicar duas vezes na mesma refeição no mesmo dia retorna toast "Refeição já registrada hoje"
- [ ] Após clicar, o card muda para status `served` com horário real
- [ ] Barra de progresso reflete corretamente (ex: 2/4 = 50%)
- [ ] "Última refeição: há X min" aparece no footer
- [ ] Sem `DietPlan` ativo, `DailyStatusScreen` não renderiza (página mantém tabs normais)

---

## 6. Fase 2 — Family Sync

### Objetivo

Múltiplos membros de uma família podem compartilhar o acompanhamento de um pet. Qualquer membro pode registrar "Dei agora". O feed mostra quem deu cada refeição.

### 6.1 Migração de banco

Adicionar modelo `PetMember`:

```prisma
model PetMember {
  id        String     @id @default(cuid())
  petId     String
  userId    String
  role      MemberRole @default(VIEWER)
  invitedAt DateTime   @default(now())
  joinedAt  DateTime?
  createdAt DateTime   @default(now())

  pet  Pet  @relation(fields: [petId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([petId, userId])
  @@map("pet_members")
}

enum MemberRole {
  OWNER    // Criador do pet — pode excluir e convidar
  CAREGIVER // Pode registrar refeições, pesos, logs
  VIEWER   // Só leitura
}
```

Adicionar relações:
```prisma
// Em model Pet:
members PetMember[]

// Em model User:
petMemberships PetMember[]
```

Adicionar modelo `PetInvite`:
```prisma
model PetInvite {
  id        String   @id @default(cuid())
  petId     String
  token     String   @unique @default(cuid())
  createdBy String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  pet Pet @relation(fields: [petId], references: [id], onDelete: Cascade)

  @@map("pet_invites")
}
```

Adicionar em `model Pet`:
```prisma
invites PetInvite[]
```

Comando:
```bash
npx prisma migrate dev --name add_family_sync
npx prisma generate
```

### 6.2 Server Actions

**Arquivo:** `lib/actions/members.actions.ts`

```typescript
// createInvite(petId) → gera token com expiresAt = now + 7 dias, retorna URL
// joinByInvite(token) → valida token, cria PetMember(role: CAREGIVER), marca usedAt
// removeMember(petId, memberId) → só OWNER pode remover
// listMembers(petId) → retorna membros com nome e foto
```

### 6.3 Lógica de permissão

Atualizar `logMeal`, `logWeight`, `addHealthLog` para aceitar tanto o dono (`pet.userId === session.user.id`) quanto membros CAREGIVER/OWNER:

```typescript
// Verificação de acesso expandida (substituir verificação atual de ownership):
const hasAccess = await prisma.$queryRaw`
  SELECT 1 FROM pets WHERE id = ${petId} AND user_id = ${userId}
  UNION
  SELECT 1 FROM pet_members WHERE pet_id = ${petId} AND user_id = ${userId} AND role IN ('OWNER', 'CAREGIVER')
  LIMIT 1
`
if (!hasAccess) return { error: "Acesso negado" }
```

### 6.4 Componentes

**`components/members/invite-button.tsx`** — botão que gera link de convite e copia para clipboard.

**`components/members/member-list.tsx`** — lista avatares dos membros com role badge.

**`app/(dashboard)/pets/[petId]/members/page.tsx`** — página de gerenciamento de membros (só OWNER acessa).

**`app/(dashboard)/invite/[token]/page.tsx`** — página pública de aceite de convite.

### 6.5 Atualizar `DailyStatusScreen`

Exibir quem serviu: "Servido às 12:03 por **Guilherme**" (usando `servedBy.name` que já vem no include de `mealLogs`).

### 6.6 Critérios de aceite — Fase 2

- [ ] Dono pode gerar link de convite com expiração de 7 dias
- [ ] Convidado acessa a URL, faz login, e é adicionado como CAREGIVER
- [ ] CAREGIVER consegue registrar "Dei agora" e ver o feed
- [ ] VIEWER só consegue visualizar, não interagir
- [ ] "Servido às XX:XX por Nome" aparece corretamente no card da refeição

---

## 7. Fase 3 — Saúde Completa

### Objetivo

UI completa para VetAppointment e Deworming (os modelos já existem no banco, falta a UI). Novo modelo Vaccine. Linha do tempo de saúde na aba Saúde.

### 7.1 Migração de banco

Adicionar modelo `Vaccine`:
```prisma
model Vaccine {
  id          String   @id @default(cuid())
  petId       String
  name        String   // ex: "Quádrupla Felina", "Raiva"
  appliedAt   DateTime
  nextDueAt   DateTime?
  lotNumber   String?
  vetName     String?
  notes       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  pet Pet @relation(fields: [petId], references: [id], onDelete: Cascade)

  @@index([petId])
  @@map("vaccines")
}
```

Adicionar em `model Pet`:
```prisma
vaccines Vaccine[]
```

Comando:
```bash
npx prisma migrate dev --name add_vaccine
npx prisma generate
```

### 7.2 Server Actions

**Arquivo:** `lib/actions/health.actions.ts` (expandir o existente)

```typescript
// Funções a adicionar:
createVetAppointment(input: { petId, title, vetName?, clinicName?, scheduledAt, notes? })
completeVetAppointment(appointmentId: string, completedAt: Date)
cancelVetAppointment(appointmentId: string)

addDeworming(input: { petId, product, doseMg?, appliedAt, nextDueAt?, notes? })

addVaccine(input: { petId, name, appliedAt, nextDueAt?, lotNumber?, vetName?, notes? })
```

### 7.3 Componentes

**`components/health/vet-appointment-list.tsx`** — lista de consultas ordenadas por data, separando futuras e passadas.

**`components/health/add-vet-appointment-form.tsx`** — formulário com datetime-local picker.

**`components/health/deworming-list.tsx`** — lista de vermifugações com próxima dose em destaque.

**`components/health/add-deworming-form.tsx`** — formulário simples.

**`components/health/vaccine-list.tsx`** — lista de vacinas com badge "Próxima em X dias" quando `nextDueAt < 30 dias`.

**`components/health/add-vaccine-form.tsx`** — formulário com select de vacinas comuns (Quádrupla, Tríplice, Raiva, Leucemia).

**`components/health/health-timeline.tsx`** — linha do tempo unificada mesclando HealthLog + VetAppointment + Deworming + Vaccine, ordenados por data.

### 7.4 Atualizar aba Saúde

A aba Saúde em `app/(dashboard)/pets/[petId]/page.tsx` passa de uma lista simples para uma timeline completa + seções por categoria.

### 7.5 Atualizar `getPetById`

Incluir `vaccines`, expandir `vetAppointments` (remover filtro de `status: "SCHEDULED"` — mostrar todos, ordenar desc), incluir `dewormings`.

### 7.6 Critérios de aceite — Fase 3

- [ ] Tutor consegue agendar consulta veterinária com título e data
- [ ] Consultas futuras aparecem primeiro, passadas depois
- [ ] Vermifugação exibe "Próxima dose em X dias" em vermelho quando próxima
- [ ] Vacinas exibem badge de alerta quando `nextDueAt` está dentro de 30 dias
- [ ] Health timeline mistura todos os eventos de saúde em ordem cronológica

---

## 8. Fase 4 — Água + Dashboard de Métricas

### Objetivo

Tutor registra ingestão de água diária. Dashboard com gráficos de tendências: peso semanal, refeições cumpridas por dia, hidratação.

### 8.1 Migração de banco

```prisma
model WaterLog {
  id         String   @id @default(cuid())
  petId      String
  loggedAt   DateTime @default(now())
  milliliters Int                          // ml bebidos (ou ofertados)
  notes      String?  @db.Text
  createdAt  DateTime @default(now())

  pet Pet @relation(fields: [petId], references: [id], onDelete: Cascade)

  @@index([petId, loggedAt])
  @@map("water_logs")
}
```

Referência veterinária: gatos devem beber ~50ml/kg/dia. Usar `pet.weightLogs.at(-1).weightKg * 50` como meta.

```bash
npx prisma migrate dev --name add_water_log
npx prisma generate
```

### 8.2 Server Actions

**Arquivo:** `lib/actions/water.actions.ts`

```typescript
logWater(input: { petId, milliliters, loggedAt? })
// Validação: milliliters entre 1 e 2000
```

### 8.3 Componentes

**`components/tracker/log-water-form.tsx`** — mesmo padrão expand/collapse de `log-weight-form.tsx`. Exibe meta do dia calculada pelo peso.

**`components/tracker/water-progress.tsx`** — barra de progresso circular do dia (consumido vs. meta).

**`components/dashboard/metrics-dashboard.tsx`** — painel com 4 gráficos Recharts:
1. **Curva de peso** — últimas 4 semanas (LineChart)
2. **Refeições/dia** — últimos 7 dias (BarChart, 0-4 refeições)
3. **Hidratação/dia** — últimos 7 dias vs. meta (BarChart com linha de meta)
4. **Score do dia** — gauge circular (0-100% de meta calórica atingida)

### 8.4 Nova rota `/dashboard`

O dashboard atual só mostra PetCards. Passar a mostrar, para o pet principal (ou o selecionado):
- `MetricsDashboard` com os 4 gráficos
- Acesso rápido: "Registrar peso" / "Registrar água"

### 8.5 Critérios de aceite — Fase 4

- [ ] Tutor registra quantos ml de água o pet bebeu
- [ ] Barra de progresso de água mostra % da meta diária em tempo real
- [ ] Gráficos carregam dados reais do banco (não mocks)
- [ ] BarChart de refeições exibe dias sem nenhuma refeição como barra zero (não ausente)

---

## 9. Regras transversais (aplicar em todas as fases)

### TypeScript
- Strict mode — nenhum `any` implícito
- Sem `!` non-null assertions — usar `?.` e `?? ""`
- Exportar tipos derivados de queries Prisma (`ReturnType<typeof fn>`)

### Segurança
- Todo Server Action verifica `session?.user?.id`
- Todo Server Action verifica ownership do pet antes de qualquer mutação
- Nas fases 2+, verificar acesso via PetMember também

### Serialização
- Qualquer modelo Prisma com campo `Decimal` que chegar a um Client Component DEVE passar pelo padrão `JSON.parse(JSON.stringify()) + parseFloat()`
- `Date` do Prisma vira `string` ISO após o mesmo processo — usar `new Date(str)` ao comparar

### Reutilização de padrões existentes
- Formulários: padrão expand/collapse com estado `open` (ver `log-weight-form.tsx`)
- Feedback: sempre `toast.success()` / `toast.error()` via Sonner
- Loading: estado `loading` local com `disabled` no botão
- Cards: usar `Card + CardContent + CardHeader + CardTitle` do Shadcn

### Internacionalização
- Textos em PT-BR (o produto é brasileiro)
- Datas: `formatDate()` de `lib/utils.ts` (usa date-fns ptBR)
- Pesos: `formatWeight()` de `lib/utils.ts` (< 1kg → gramas, >= 1kg → quilos)

### Performance
- `revalidatePath()` após toda mutação para invalidar o cache do RSC
- `getPetById` usa `include` seletivo — não adicionar `include` desnecessários

---

## 10. Checkpoints de qualidade

Rodar após cada fase completa:

```bash
npx tsc --noEmit          # Zero erros TypeScript
npx prisma validate       # Schema válido
npx prisma db pull        # Confirmar que banco bate com schema
```

Teste manual mínimo por fase:
- **Fase 1:** criar plano → clicar "Dei agora" → verificar MealLog no banco → clicar de novo → toast de erro
- **Fase 2:** gerar link → abrir em aba anônima → aceitar convite → "Dei agora" como convidado
- **Fase 3:** agendar consulta → exibir na lista → marcar como concluída
- **Fase 4:** registrar 200ml → barra avança → gráfico do dia mostra o registro
