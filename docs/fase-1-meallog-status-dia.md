# Fase 1 — MealLog + Tela de Status do Dia

> **Objetivo:** Transformar o boris.app de um app de *cadastro* em um app de *acompanhamento em tempo real*. O tutor confirma com um toque que o pet comeu e vê quanto falta para completar o dia.

---

## Executar agora

Sequência linear — execute na ordem, sem pular etapas.

```bash
# 1. Banco (só se add_tutor_routine ainda não rodou nesta máquina)
npx prisma migrate dev --name add_tutor_routine   # pular se migration já existir

# 2. Schema MealLog
#    → editar prisma/schema.prisma (Passo 1 abaixo)
npx prisma migrate dev --name add_meal_log
npx prisma generate

# 3. Checkpoint técnico após cada bloco de código
npx tsc --noEmit
```

| # | Arquivo | Ação | Evidência de conclusão |
|---|---|---|---|
| 1 | [`prisma/schema.prisma`](../prisma/schema.prisma) | Adicionar `MealLog` + relações | Migration `add_meal_log` aplicada |
| 2 | [`lib/db/pets.ts`](../lib/db/pets.ts) | `getPetById` inclui `mealLogs` do dia; `serializePet` serializa Decimals | `SerializedPet` expõe `mealLogs` |
| 3 | [`lib/actions/meals.actions.ts`](../lib/actions/meals.actions.ts) | Criar `logMeal` + `getTodayMealStatus` | Actions compilam; idempotência retorna erro |
| 4 | [`components/tracker/daily-status-screen.tsx`](../components/tracker/daily-status-screen.tsx) | UI de status do dia + botões | Cards renderizam 4 status |
| 5 | [`app/(dashboard)/pets/[petId]/page.tsx`](../app/(dashboard)/pets/[petId]/page.tsx) | `<DailyStatusScreen>` acima das tabs | Só aparece com `DietPlan` ativo |
| 6 | [`lib/actions/nutrition.actions.ts`](../lib/actions/nutrition.actions.ts) | Remover `(prisma.dietPlan.create as Function)` | Tipagem normal do Prisma |
| 7 | [`components/nutrition/nutrition-summary.tsx`](../components/nutrition/nutrition-summary.tsx) | Remover cast `wakeTime/sleepTime` | Campos tipados nativamente |

**Checkpoint final:** `npx tsc --noEmit` sem erros + checklist de [Validação](#validação).

---

## Pré-requisitos

### O que já existe no codebase

| Camada | Estado atual |
|---|---|
| Schema | `DietPlan` (NED, RER, mealsPerDay, wakeTime, sleepTime) + `DietItem` (gramas/dia) |
| Lógica | `distributeMeals()` em [`lib/nutrition/formulas.ts`](../lib/nutrition/formulas.ts) |
| UI | Página do pet com tabs Crescimento / Nutrição / Saúde |
| Actions | `createDietPlan`, `addDietItem`, `addHealthLog`, `logWeight` |

**Lacuna:** nenhuma refeição é confirmada. O app planeja mas não acompanha. Não há histórico de "comeu às 12:03".

### Ambiente

- [ ] `.env` com `DATABASE_URL` e `DIRECT_URL` configurados
- [ ] Migration `add_tutor_routine` aplicada (já existe em `prisma/migrations/20260524175654_add_tutor_routine/`)
- [ ] Dev server rodando (`npm run dev`) para testes manuais ao final

### Workarounds a remover após `prisma generate`

| Arquivo | Workaround atual |
|---|---|
| `lib/actions/nutrition.actions.ts` | `(prisma.dietPlan.create as Function)({...})` |
| `components/nutrition/nutrition-summary.tsx` | `const p = plan as typeof plan & { wakeTime?: ... }` |

---

## Regras de negócio

Referência única — não reinterpretar durante a implementação.

### Idempotência

- **Regra:** no máximo 1 `MealLog` por `(petId, mealNumber)` por dia civil.
- **Implementação:** checar `servedAt` entre `startOfToday` e `startOfTomorrow` antes de criar.
- **Erro esperado:** `"Refeição já registrada hoje"` em duplo-clique.

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const existing = await prisma.mealLog.findFirst({
  where: { petId, mealNumber, servedAt: { gte: today, lt: tomorrow } },
});
if (existing) return { error: "Refeição já registrada hoje" };
```

### Dia atual (timezone)

- **Regra:** "hoje" = meia-noite local do servidor até meia-noite seguinte (`setHours(0,0,0,0)`).
- **Usar em:** `logMeal`, `getTodayMealStatus`, filtro de `mealLogs` em `getPetById`.
- **Armadilha:** não usar `toISOString().slice(0,10)` — quebra em fusos ≠ UTC.

### DietPlan ativo

- **Regra:** `DailyStatusScreen` só renderiza se `pet.dietPlans[0]` existir (`isActive: true`).
- **Sem plano:** página do pet permanece igual (tabs normais, sem seção de status).

### Status por refeição

| Status | Condição |
|---|---|
| `served` | Existe `MealLog` hoje para esse `mealNumber` |
| `due` | Horário planejado passou há ≤ 60 min e ainda não servida |
| `missed` | Horário planejado passou há > 60 min e ainda não servida |
| `upcoming` | Horário planejado ainda não chegou |

### Gramas por refeição

- `plannedGrams` = soma de `dailyGrams` de todos `DietItem` ÷ `mealsPerDay`.
- Horários = `distributeMeals(nedKcal, mealsPerDay, wakeTime, sleepTime)`.

### Autenticação e ownership

1. `auth()` obrigatório em server actions.
2. Pet deve pertencer ao `session.user.id`.
3. `servedByUserId = session.user.id` em todo `MealLog`.

---

## Passos de implementação

### Passo 1 — Schema Prisma

**Arquivo:** [`prisma/schema.prisma`](../prisma/schema.prisma)

- [ ] Adicionar modelo `MealLog` (ver [Referência técnica](#referência-técnica))
- [ ] Adicionar relações: `Pet.mealLogs`, `DietPlan.mealLogs`, `User.mealLogs`
- [ ] Rodar `npx prisma migrate dev --name add_meal_log && npx prisma generate`

**Evidência:** tabela `meal_logs` no banco; `prisma.mealLog` disponível no client.

---

### Passo 2 — Query e serialização

**Arquivo:** [`lib/db/pets.ts`](../lib/db/pets.ts)

- [ ] Calcular `startOfToday` / `startOfTomorrow` (mesma lógica das regras de negócio)
- [ ] Incluir em `getPetById`:

```typescript
mealLogs: {
  where: { servedAt: { gte: startOfToday, lt: startOfTomorrow } },
  orderBy: { servedAt: "desc" },
  include: { servedBy: { select: { name: true } } },
}
```

- [ ] Estender tipo em `serializePet` e mapear Decimals:

```typescript
mealLogs: raw.mealLogs.map((ml) => ({
  ...ml,
  plannedGrams: parseFloat(ml.plannedGrams),
  actualGrams: ml.actualGrams ? parseFloat(ml.actualGrams) : null,
}))
```

**Evidência:** `SerializedPet` inclui `mealLogs: Array<{...}>` tipado.

---

### Passo 3 — Server Actions

**Arquivo:** [`lib/actions/meals.actions.ts`](../lib/actions/meals.actions.ts) *(criar)*

#### `logMeal`

- [ ] Validar sessão e ownership do pet
- [ ] Checar idempotência (regra acima)
- [ ] Criar `MealLog` com `servedAt = now()`, `servedByUserId = session.user.id`
- [ ] `revalidatePath(\`/pets/${petId}\`)`
- [ ] Retornar `{ data }` ou `{ error }`

```typescript
logMeal(input: {
  petId: string;
  dietPlanId: string;
  mealNumber: number;
  scheduledTime: string;   // "HH:MM"
  plannedGrams: number;
  actualGrams?: number;
  notes?: string;
}): Promise<{ data: MealLog } | { error: string }>
```

#### `getTodayMealStatus`

- [ ] Buscar `DietPlan` ativo + `DietItems` + `mealLogs` do dia
- [ ] Montar array de refeições com status (`upcoming` | `due` | `served` | `missed`)
- [ ] Calcular `summary.completionPercent`, `minutesSinceLastMeal`

**Evidência:** chamar `logMeal` duas vezes no mesmo `mealNumber` → segunda retorna erro.

---

### Passo 4 — Componente DailyStatusScreen

**Arquivo:** [`components/tracker/daily-status-screen.tsx`](../components/tracker/daily-status-screen.tsx) *(criar)*

- [ ] Props: `{ pet: SerializedPet }` — plano ativo em `pet.dietPlans[0]`
- [ ] Header: nome do pet, NED kcal/dia
- [ ] Barra de progresso: `servedCount / totalMeals`
- [ ] Lista de cards por refeição (horário, alimentos, status)
- [ ] Footer: "Última refeição: há X min"

| Status | Visual | Ação |
|---|---|---|
| `served` | Borda verde, ✅, horário real | Nenhuma |
| `due` | Borda primary pulsando, ⏰ | Botão grande "✓ Dei agora" |
| `missed` | Borda vermelha, ⚠️ | Botão menor "Registrar mesmo assim" |
| `upcoming` | Borda dashed muted, 🔜 | Nenhuma |

Handler do botão:

```typescript
async function handleServe(mealNumber: number, scheduledTime: string) {
  setLoadingMeal(mealNumber);
  const result = await logMeal({
    petId: pet.id,
    dietPlanId: plan.id,
    mealNumber,
    scheduledTime,
    plannedGrams: totalGramsForMeal,
  });
  if (result.error) toast.error(result.error);
  else toast.success("✅ Refeição registrada!");
  setLoadingMeal(null);
}
```

**Evidência:** card `due` exibe botão; após clique vira `served` sem reload manual (via `revalidatePath`).

---

### Passo 5 — Integrar na página do pet

**Arquivo:** [`app/(dashboard)/pets/[petId]/page.tsx`](../app/(dashboard)/pets/[petId]/page.tsx)

- [ ] Importar `DailyStatusScreen`
- [ ] Renderizar **acima das tabs**, abaixo do header do pet
- [ ] Condicional: `{activePlan && <DailyStatusScreen pet={serializedPet} />}`
- [ ] **Não remover** tabs existentes (Crescimento / Nutrição / Saúde)

```
┌─ Header do Pet ─────────────────────────┐
├─ DailyStatusScreen (NOVO) ──────────────┤
├─ Tabs: Crescimento | Nutrição | Saúde ──┤
└─────────────────────────────────────────┘
```

**Evidência:** pet sem plano → sem seção de status; pet com plano → seção visível.

---

### Passo 6 — Limpar workarounds

- [ ] `nutrition.actions.ts`: remover cast `as Function`
- [ ] `nutrition-summary.tsx`: remover cast de `wakeTime`/`sleepTime`

**Evidência:** `npx tsc --noEmit` limpo.

---

## Referência técnica

### Modelo Prisma

```prisma
model MealLog {
  id             String   @id @default(cuid())
  petId          String
  dietPlanId     String
  mealNumber     Int
  scheduledTime  String
  servedAt       DateTime @default(now())
  servedByUserId String
  plannedGrams   Decimal  @db.Decimal(7, 2)
  actualGrams    Decimal? @db.Decimal(7, 2)
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

Relações a adicionar: `Pet.mealLogs`, `DietPlan.mealLogs`, `User.mealLogs`.

### Contrato `getTodayMealStatus`

```typescript
interface TodayMealStatus {
  plan: {
    id: string;
    mealsPerDay: number;
    nedKcal: number;
    wakeTime: string | null;
    sleepTime: string | null;
  };
  meals: Array<{
    mealNumber: number;
    scheduledTime: string;
    plannedGrams: number;
    status: "upcoming" | "due" | "served" | "missed";
    servedAt: string | null;
    servedByName: string | null;
    minutesSinceLastMeal: number | null;
  }>;
  summary: {
    totalMeals: number;
    servedCount: number;
    pendingCount: number;
    lastServedAt: string | null;
    minutesSinceLastMeal: number | null;
    completionPercent: number;
  };
}
```

### Wireframe da UI

```
┌─────────────────────────────────────────┐
│  🐱 Boris                      hoje     │
│  450g · 102 kcal/dia                    │
├─────────────────────────────────────────┤
│  ✅ 2 de 4 refeições completas  50%     │
│  [████████░░░░░░░░]                     │
├─────────────────────────────────────────┤
│  🌅 07:00  Refeição 1     ✅ SERVIDA    │
│  Servido às 07:14 por Guilherme         │
│  ☀️ 12:00  Refeição 2     ⏰ AGORA     │
│  [ ✓ Dei agora ]                        │
│  🌤️ 17:00  Refeição 3     🔜 17:00    │
├─────────────────────────────────────────┤
│  🕐 Última refeição: há 2h e 14min     │
└─────────────────────────────────────────┘
```

---

## Validação

### Testes manuais (fluxo feliz)

| # | Ação | Evidência esperada |
|---|---|---|
| 1 | Abrir pet **com** `DietPlan` ativo | `DailyStatusScreen` visível acima das tabs |
| 2 | Abrir pet **sem** plano | Seção de status **ausente**; tabs normais |
| 3 | Clicar "✓ Dei agora" em refeição `due` | Toast de sucesso; card vira `served` com horário real |
| 4 | Clicar novamente na mesma refeição | Toast de erro "Refeição já registrada hoje"; **sem** registro duplicado no banco |
| 5 | Registrar 2 de 4 refeições | Barra mostra 50%; texto "2 de 4 refeições completas" |
| 6 | Aguardar após última refeição servida | Footer atualiza "há X min" (recarregar página basta) |

### Verificação no banco

```sql
SELECT id, meal_number, scheduled_time, served_at, served_by_user_id
FROM meal_logs
WHERE pet_id = '<petId>'
ORDER BY served_at DESC;
```

- [ ] Cada clique válido gera exatamente 1 linha
- [ ] `served_at` reflete timestamp real (não o horário planejado)
- [ ] Duplo-clique não gera linha extra

### Verificação técnica final

```bash
npx tsc --noEmit
```

- [ ] Zero erros de compilação
- [ ] Workarounds de `nutrition.actions.ts` e `nutrition-summary.tsx` removidos

---

## Riscos e armadilhas

| Risco | Sintoma | Mitigação |
|---|---|---|
| **Duplicidade no mesmo dia** | Dois logs para refeição 2 | Checar idempotência **antes** do `create`; retornar erro amigável |
| **Cálculo de "hoje" errado** | Logs de ontem aparecem hoje (ou vice-versa) | Usar `setHours(0,0,0,0)` local; **não** comparar strings ISO de data |
| **Pet sem DietPlan ativo** | Tela quebrada ou botões sem plano | Guard clause: só renderizar `DailyStatusScreen` se `dietPlans[0]` existir |

---

## Fora de escopo (próximas fases)

- **Fase 2 — Family Sync:** `PetMember`, convite por link, feed compartilhado
- **Fase 3 — Saúde:** UI para `VetAppointment`, `Deworming`, modelo `Vaccine`
- **Fase 4 — Água:** `WaterLog`, dashboard de hidratação
