# Crescimento de peso mais claro + preferências de tracking por pet

**Data:** 2026-06-16
**Escopo:** mudanças no gráfico de peso do dashboard + sistema novo de preferências de rastreamento por pet.

## Contexto

Hoje o gráfico de peso em `MetricsDashboard` (período de 4 semanas) plota só os dias com pesagem registrada, com eixo Y `[0, auto]`. Quando um filhote sai de 345g e chega em 639g em 23 dias, a curva fica visualmente comprimida e ganhos diários não se distinguem do ruído.

E o app rastreia 7 categorias por pet (peso, nutrição, hidratação, sintomas, vermifugação, vacinas, consultas vet), mas todas são forçadas para todo tutor. Tutores que não querem controlar, por exemplo, hidratação ou vacinas, têm UI poluída com cards e formulários que nunca usam.

## Goals

1. Crescimento de peso fica óbvio em 1s de olhar.
2. Dias sem pesagem viram pontos interpolados visualmente distintos.
3. Tutor escolhe quais 6 categorias rastrear por pet (peso continua sempre ativo).
4. Desligar uma categoria esconde UI mas preserva dados.

## Não-goals

- Re-design global do dashboard.
- Faixas "saudáveis" por idade/raça (precisa de tabela de referência que não temos).
- Extrapolação de peso para fora do range de pesagens.
- Preferências por usuário (sempre por pet).

---

## Parte 1 — Gráfico de peso

### 1.1 Auto-zoom no eixo Y

`MetricsDashboard.tsx` (componente do gráfico "Curva de Peso (4 semanas)"):

- Hoje: `<YAxis tickFormatter={(v) => \`${v}g\`} />` deixa o domínio em `[0, auto]`.
- Mudança: domínio em `[Math.floor((minG - padding) / 50) * 50, Math.ceil((maxG + padding) / 50) * 50]` onde `padding = max(20, (maxG - minG) * 0.10)`, arredondado para múltiplos de 50g para ficar legível.
- Rótulo discreto abaixo do gráfico: `"escala ajustada — Y não inicia em 0"` (sem alarmismo, só honestidade).
- Caso especial: se `minG === maxG` (1 ponto só), continua usando `[0, max * 1.5]`.

### 1.2 Linha de tendência

- Regressão linear simples (least squares) **apenas sobre as pesagens reais**, computada em `buildWeightChartData`.
- Output: `WeightSummary` ganha campos `trendStartG: number` e `trendEndG: number` (peso projetado nos extremos do período).
- Render: novo `<Line>` no chart com `stroke="#22c55e"`, `strokeDasharray="6 3"`, `opacity={0.6}`, sem dots. `dataKey="tendencia"`.

### 1.3 Área sob a curva

- `<Area>` (Recharts) com `dataKey="peso"`, fill linear gradient roxo → transparente.
- Renderizar atrás da linha principal.

### 1.4 Interpolação diária

**Algoritmo** (em `buildWeightChartData`):

1. Iterar dia-a-dia do `firstRealDay` ao `lastRealDay` (sem extrapolar).
2. Para cada dia:
   - Se há pesagem registrada nesse dia (qualquer hora) → ponto real com a média do dia se houver múltiplas.
   - Senão → interpolação linear entre o último ponto real anterior e o próximo ponto real posterior.

**Mudança em `WeightChartPoint`:**

```ts
export interface WeightChartPoint {
  date: string;            // "DD/MM" para o eixo X
  peso: number;            // gramas (já existente)
  pesoKg: number;          // já existente
  isInterpolated: boolean; // NOVO
  deltaG: number | null;   // já existente — calculado dia-a-dia agora
  weekGrowthG: number | null; // já existente
}
```

**Renderização — pontos reais vs estimados:**

Recharts não suporta nativamente segmentos de linha alternando estilos no mesmo dataset. Solução:

- Plotar **duas linhas sobrepostas**:
  - `<Line dataKey="peso" stroke="#a78bfa" strokeWidth={2.5} dot={renderDot} activeDot={renderActiveDot} />` — linha sólida principal.
  - Por cima, para o trecho tracejado, usar o `dot` customizado que decide ponto cheio vs vazado pelo `isInterpolated`.
  - Para os **segmentos** tracejados: renderizar uma segunda `<Line>` com `strokeDasharray="4 3"` que só conecta pontos onde **algum dos dois extremos é interpolado**, com um dataset auxiliar onde os trechos sólidos têm `null`. Isso quebra a linha tracejada nos pontos certos.

Função `renderDot`:

```ts
function renderDot(props: { cx: number; cy: number; payload: WeightChartPoint }) {
  if (props.payload.isInterpolated) {
    return (
      <circle cx={props.cx} cy={props.cy} r={2.5}
        fill="var(--background)" stroke="#a78bfa" strokeWidth={1.2} />
    );
  }
  return (
    <circle cx={props.cx} cy={props.cy} r={3.5}
      fill="#a78bfa" stroke="#fff" strokeWidth={0.8} />
  );
}
```

**Tooltip:** quando `isInterpolated`, em vez de "Peso: 550g (vs anterior +25g)", mostra `"Peso estimado: 550g"` + linha auxiliar `"Entre 14/06 (500g) e 16/06 (600g)"`.

### 1.5 Resumo (`WeightSummaryPanel`) — não muda comportamento

- **Média, mín, máx, variação total, cresc. semanal** continuam calculados **apenas sobre pesagens reais**.
- Justificativa: interpolação é só para visual; estatísticas não devem incorporar estimativas.

### 1.6 Histórico de pesagens

A lista `Histórico de pesagens` na tab Crescimento (`app/(dashboard)/pets/[petId]/page.tsx`) continua só com pesagens reais, sem dias interpolados.

### 1.7 Gráfico simples na pet page

A tab Crescimento da pet page usa hoje um `<WeightChart>` separado e mais simples (`components/tracker/weight-chart.tsx`), que não passa por `metrics.ts`. **Este componente será substituído** pelo mesmo gráfico enriquecido do dashboard — extraído de `MetricsDashboard` para um componente isolado `<WeightCurveCard>` reutilizado nos dois lugares. `components/tracker/weight-chart.tsx` é deletado.

---

## Parte 2 — Preferências de tracking

### 2.1 Modelo de dados

Nova tabela em `prisma/schema.prisma`:

```prisma
model PetPreferences {
  id              String   @id @default(cuid())
  petId           String   @unique
  trackNutrition  Boolean  @default(true)
  trackHydration  Boolean  @default(true)
  trackSymptoms   Boolean  @default(true)
  trackDeworming  Boolean  @default(true)
  trackVaccines   Boolean  @default(true)
  trackVetVisits  Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  pet Pet @relation(fields: [petId], references: [id], onDelete: Cascade)

  @@map("pet_preferences")
}
```

Adicionar relation em `Pet`:
```prisma
preferences PetPreferences?
```

**Por que tabela separada e não JSON em `Pet`:**
- Queries simples sem `JSONB`.
- Futuras preferências (formato de gráfico, unidades, frequência de pesagem desejada) entram aqui sem migração de tipo.
- Nullable na pet permite "ainda não configurado" = comportamento default.

**Backfill:** migration cria 1 registro por pet existente com todos os campos `true` (= comportamento atual preservado). Função utilitária para resolução:

```ts
// lib/db/preferences.ts
export const DEFAULT_PREFS = {
  trackNutrition: true,
  trackHydration: true,
  trackSymptoms: true,
  trackDeworming: true,
  trackVaccines: true,
  trackVetVisits: true,
};

export async function getPetPreferences(petId: string) {
  const found = await prisma.petPreferences.findUnique({ where: { petId } });
  return found ?? { petId, ...DEFAULT_PREFS };
}
```

Componentes que precisam saber das prefs recebem o objeto inteiro como prop (ou via `serializePet`).

### 2.2 Página de configurações

**Rota:** `app/(dashboard)/pets/[petId]/settings/page.tsx` (servidor).

**Permissão:** apenas `OWNER` acessa. CAREGIVER e VIEWER recebem 403/redirect para a pet page com toast "Só o dono do pet pode mudar isso".

**Estrutura:**

- Header igual ao pet page (avatar + nome + breadcrumb "← voltar").
- Card único com lista de 6 toggles + linha "Peso & crescimento — sempre ativo (base do app)" disabled no topo.
- Cada toggle = componente `<Switch>` (precisa adicionar a `components/ui/switch.tsx` do shadcn) + label + sub-label explicando o que some/aparece.
- Botão "Salvar" no rodapé do card que chama server action `updatePetPreferences`.

**Server action:** `lib/actions/preferences.actions.ts` com `updatePetPreferences({ petId, prefs })`. Valida que `userId === pet.userId` (não `userHasPetMutationAccess` — esse permite CAREGIVER, e aqui não queremos).

### 2.3 Botão no header da pet page

`app/(dashboard)/pets/[petId]/page.tsx` linha 148-159 (botões "Exportar PDF" / "Família"):

```tsx
<Button asChild variant="outline" size="sm">
  <Link href={`/pets/${petId}/settings`}>⚙️ Configurar tracking</Link>
</Button>
```

Só aparece se `isOwner === true`.

### 2.4 Cascade — o que some quando

Consumidor sempre chama `getPetPreferences(petId)` e ramifica.

| Toggle | Some |
|---|---|
| `trackNutrition` off | • Tab "🍽️ Nutrição" da pet page<br>• `<DailyStatusScreen>` na pet page<br>• Card "Refeições por Dia (7 dias)" do dashboard<br>• Card "Score do Dia" do dashboard |
| `trackHydration` off | • Bloco "Hidratação hoje" dentro da tab Crescimento<br>• Card "Hidratação (7 dias vs meta)" do dashboard<br>• Metade direita ("Hidratação") do card "Score do Dia"<br>• Botão `LogWaterForm` em todas as posições |
| `trackSymptoms` off | • `<HealthLogList>` + `<AddHealthLogForm>` na tab Saúde<br>• Linhas de tipo `SYMPTOM` na `<HealthTimeline>` |
| `trackDeworming` off | • `<DewormingList>` + `<AddDewormingForm>` na tab Saúde<br>• Linhas correspondentes na timeline |
| `trackVaccines` off | • `<VaccineList>` + `<AddVaccineForm>` na tab Saúde<br>• Linhas correspondentes na timeline |
| `trackVetVisits` off | • `<VetAppointmentList>` + `<AddVetAppointmentForm>` na tab Saúde<br>• Linhas correspondentes na timeline |

**Caso especial — tab Saúde inteira:**

Se os 4 toggles clínicos (`trackSymptoms`, `trackDeworming`, `trackVaccines`, `trackVetVisits`) estão **todos** off → a tab inteira "🩺 Saúde" some do `<TabsList>` da pet page. Se pelo menos 1 está on, a tab continua e mostra só os blocos ativos.

**Caso especial — Score do Dia:**

Se `trackNutrition` off, o card inteiro "Score do Dia" some. Não vira "score do peso" — sem razão de ser sem refeições para pontuar.

### 2.5 Dashboard `/dashboard`

`MetricsDashboard` recebe `preferences` como prop e omite cards inteiros conforme tabela acima. Layout `grid lg:grid-cols-2` se adapta naturalmente quando alguns cards somem.

Mínimo absoluto exibido (todos os 6 toggles off): só "Curva de Peso (4 semanas)". Botão "Pesagem nova" continua disponível.

---

## Arquivos afetados

**Novos:**

- `prisma/schema.prisma` — modelo `PetPreferences`
- Migration: `prisma/migrations/<ts>_pet_preferences/migration.sql` com backfill `INSERT INTO pet_preferences (...) SELECT id, true, true, true, true, true, true FROM pets`
- `lib/db/preferences.ts` — `getPetPreferences`, `DEFAULT_PREFS`, types
- `lib/actions/preferences.actions.ts` — `updatePetPreferences` server action
- `app/(dashboard)/pets/[petId]/settings/page.tsx` — página de configurações
- `components/pets/tracking-preferences-form.tsx` — formulário client com os 6 toggles
- `components/ui/switch.tsx` — shadcn Switch (não tem ainda)
- `components/tracker/weight-curve-card.tsx` — componente isolado do gráfico enriquecido (extraído de `MetricsDashboard`), reutilizado em dashboard e pet page

**Modificados:**

- `lib/db/metrics.ts` — `buildWeightChartData` reescrita com interpolação diária + tendência; `WeightChartPoint` ganha `isInterpolated`
- `lib/db/pets.ts` — `getPetById` e `serializePet` incluem `preferences`
- `components/dashboard/metrics-dashboard.tsx` — usa `<WeightCurveCard>`, aceita prop `preferences` e omite cards conforme cascade
- `app/(dashboard)/pets/[petId]/page.tsx` — usa `<WeightCurveCard>`, adiciona botão settings, ramifica tabs/cards por preferences
- `app/(dashboard)/dashboard/page.tsx` — passa `preferences` para `MetricsDashboard`
- `components/health/health-timeline.tsx` — filtra eventos por preferences

**Deletados:**

- `components/tracker/weight-chart.tsx` — substituído por `<WeightCurveCard>`

## Estratégia de teste

- **Unit (`lib/db/metrics.ts`):** interpolação, tendência, auto-zoom em casos: 1 ponto, 2 pontos, vários pontos com gaps, gap no início, gap no final, todos os pontos no mesmo dia.
- **Unit (`lib/db/preferences.ts`):** retorna defaults quando não há registro; merge correto.
- **E2E (`playwright`):** owner muda toggles → recarrega pet page e dashboard, confirma componentes somem/aparecem.
- **Permission:** CAREGIVER tenta abrir `/pets/[id]/settings` → redirecionado.

## Riscos e considerações

- Recharts e linhas com estilos alternados: a abordagem de "linha auxiliar tracejada" precisa validar visualmente. Plano B se não funcionar: usar `connectNulls={false}` com dataset duplicado (sólido com `null` nos pontos interpolados, tracejado com `null` nos reais).
- Migration de backfill em produção (Vercel + Neon): rodar em momento de baixo tráfego ou usar `prisma migrate deploy` com lock. Pets criados entre migration e deploy do código novo já caem no fallback `DEFAULT_PREFS` em `getPetPreferences`.
- `HealthTimeline` filtra in-component vs filtrar no query: por simplicidade da migração, filtrar no componente passando `preferences` como prop. Reavaliar se virar gargalo.

## Out of scope (próximas fases)

- Wizard durante criação do pet perguntando o que rastrear.
- Preferências de unidades (kg vs g) e idioma.
- Preferências por categoria mais finas (ex: dentro de "vacinas", só algumas).
- Permissão fina (CAREGIVER pode editar prefs específicas).
