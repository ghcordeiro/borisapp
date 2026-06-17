# Peso enriquecido + preferências de tracking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o crescimento do peso visualmente óbvio (auto-zoom, tendência, área, interpolação diária) e dar ao tutor controle por pet sobre quais 6 categorias rastrear.

**Architecture:** A — `lib/db/metrics.ts` reescrito com interpolação diária + regressão linear, alimentando um novo `<WeightCurveCard>` reutilizado em dashboard e pet page. B — Nova tabela `PetPreferences` (1-1 com `Pet`, backfill com defaults `true`), página dedicada `/pets/[id]/settings`, helper `getPetPreferences` retornando defaults quando ausente, cascade de UI condicional em dashboard cards, tabs/blocos da pet page e timeline de saúde.

**Tech Stack:** Next.js 16 (App Router + RSC) · Prisma 5 + PostgreSQL · Recharts 3 · shadcn/ui (Radix) · NextAuth 5 · Vitest (unit) · Playwright (E2E)

**Spec:** [`docs/superpowers/specs/2026-06-16-peso-crescimento-e-tracking-prefs-design.md`](../specs/2026-06-16-peso-crescimento-e-tracking-prefs-design.md)

---

## Part A — Gráfico de peso enriquecido

### Task A1: Reescrever `buildWeightChartData` com interpolação + regressão linear

**Files:**
- Modify: `lib/db/metrics.ts:6-20` (interfaces) e `lib/db/metrics.ts:138-187` (função)
- Create: `lib/db/metrics.test.ts`

- [ ] **Step 1: Criar o arquivo de testes com 7 testes falhando**

Crie `lib/db/metrics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildWeightChartData } from "./metrics";

describe("buildWeightChartData", () => {
  it("retorna vazio quando não há logs", () => {
    const { chart, summary } = buildWeightChartData([]);
    expect(chart).toEqual([]);
    expect(summary).toBeNull();
  });

  it("ponto único: 1 ponto real, sem interpolação, sem tendência", () => {
    const { chart, summary } = buildWeightChartData([
      { loggedAt: new Date("2026-06-01T10:00:00Z"), weightKg: 0.5 },
    ]);
    expect(chart).toHaveLength(1);
    expect(chart[0]!.peso).toBe(500);
    expect(chart[0]!.isInterpolated).toBe(false);
    expect(summary?.trendStartG).toBeNull();
    expect(summary?.trendEndG).toBeNull();
  });

  it("dois dias consecutivos: 2 reais, 0 interpolados", () => {
    const { chart } = buildWeightChartData([
      { loggedAt: new Date("2026-06-01T10:00:00Z"), weightKg: 0.5 },
      { loggedAt: new Date("2026-06-02T10:00:00Z"), weightKg: 0.52 },
    ]);
    expect(chart).toHaveLength(2);
    expect(chart.every((p) => !p.isInterpolated)).toBe(true);
  });

  it("gap de 1 dia: interpola ponto médio (14/06=500g, 16/06=600g → 15/06=550g)", () => {
    const { chart } = buildWeightChartData([
      { loggedAt: new Date("2026-06-14T10:00:00Z"), weightKg: 0.5 },
      { loggedAt: new Date("2026-06-16T10:00:00Z"), weightKg: 0.6 },
    ]);
    expect(chart).toHaveLength(3);
    expect(chart[0]!.peso).toBe(500);
    expect(chart[0]!.isInterpolated).toBe(false);
    expect(chart[1]!.peso).toBe(550);
    expect(chart[1]!.isInterpolated).toBe(true);
    expect(chart[2]!.peso).toBe(600);
    expect(chart[2]!.isInterpolated).toBe(false);
  });

  it("múltiplas pesagens no mesmo dia: usa a média do dia", () => {
    const { chart } = buildWeightChartData([
      { loggedAt: new Date("2026-06-01T08:00:00Z"), weightKg: 0.48 },
      { loggedAt: new Date("2026-06-01T20:00:00Z"), weightKg: 0.52 },
    ]);
    expect(chart).toHaveLength(1);
    expect(chart[0]!.peso).toBe(500);
  });

  it("summary usa apenas pesagens reais para min/max/avg", () => {
    const { summary } = buildWeightChartData([
      { loggedAt: new Date("2026-06-14T10:00:00Z"), weightKg: 0.5 },
      { loggedAt: new Date("2026-06-16T10:00:00Z"), weightKg: 0.6 },
    ]);
    expect(summary?.minG).toBe(500);
    expect(summary?.maxG).toBe(600);
    expect(summary?.avgG).toBe(550);
  });

  it("regressão linear: 300g em 01/06, 500g em 11/06 → trend 300→500", () => {
    const { summary } = buildWeightChartData([
      { loggedAt: new Date("2026-06-01T10:00:00Z"), weightKg: 0.3 },
      { loggedAt: new Date("2026-06-11T10:00:00Z"), weightKg: 0.5 },
    ]);
    expect(summary?.trendStartG).toBeCloseTo(300, 0);
    expect(summary?.trendEndG).toBeCloseTo(500, 0);
  });
});
```

- [ ] **Step 2: Rodar testes e confirmar que falham**

```bash
npx vitest run lib/db/metrics.test.ts
```

Esperado: 7 testes falhando — `WeightChartPoint.isInterpolated` não existe, `WeightSummary.trendStartG/trendEndG` não existem, e o algoritmo de interpolação ainda não roda.

- [ ] **Step 3: Atualizar as interfaces em `lib/db/metrics.ts`**

Substituir as interfaces nas linhas 6-20:

```ts
export interface WeightChartPoint {
  date: string;
  peso: number;
  pesoKg: number;
  isInterpolated: boolean;
  deltaG: number | null;
  weekGrowthG: number | null;
}

export interface WeightSummary {
  avgG: number;
  minG: number;
  maxG: number;
  totalDeltaG: number;
  weeklyGrowthG: number;
  trendStartG: number | null;
  trendEndG: number | null;
}
```

- [ ] **Step 4: Implementar helpers `groupByDay`, `interpolateDaily` e `linearRegression`**

Acima de `buildWeightChartData` em `lib/db/metrics.ts`:

```ts
type RealDailyLog = { date: Date; weightKg: number };

function groupByDay(
  logs: Array<{ loggedAt: Date; weightKg: number }>
): RealDailyLog[] {
  const buckets = new Map<string, number[]>();
  for (const log of logs) {
    const key = format(log.loggedAt, "yyyy-MM-dd");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(Number(log.weightKg));
  }
  return Array.from(buckets.entries())
    .map(([key, weights]) => ({
      date: new Date(`${key}T00:00:00.000Z`),
      weightKg: weights.reduce((s, w) => s + w, 0) / weights.length,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function interpolateDaily(real: RealDailyLog[]): Array<RealDailyLog & { isInterpolated: boolean }> {
  if (real.length === 0) return [];
  if (real.length === 1) {
    return [{ ...real[0]!, isInterpolated: false }];
  }
  const firstDay = real[0]!.date;
  const lastDay = real[real.length - 1]!.date;
  const totalDays = Math.round(
    (lastDay.getTime() - firstDay.getTime()) / MS_PER_DAY
  );
  const out: Array<RealDailyLog & { isInterpolated: boolean }> = [];
  for (let offset = 0; offset <= totalDays; offset++) {
    const day = new Date(firstDay);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = format(day, "yyyy-MM-dd");
    const realMatch = real.find((r) => format(r.date, "yyyy-MM-dd") === key);
    if (realMatch) {
      out.push({ ...realMatch, isInterpolated: false });
      continue;
    }
    const prev = [...real].reverse().find((r) => r.date < day);
    const next = real.find((r) => r.date > day);
    if (!prev || !next) continue;
    const t =
      (day.getTime() - prev.date.getTime()) /
      (next.date.getTime() - prev.date.getTime());
    const weightKg = prev.weightKg + (next.weightKg - prev.weightKg) * t;
    out.push({ date: day, weightKg, isInterpolated: true });
  }
  return out;
}

function linearRegression(
  points: Array<{ x: number; y: number }>
): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}
```

- [ ] **Step 5: Reescrever `buildWeightChartData`**

Substituir a função inteira em `lib/db/metrics.ts`:

```ts
export function buildWeightChartData(
  logs: Array<{ loggedAt: Date; weightKg: number }>
): { chart: WeightChartPoint[]; summary: WeightSummary | null } {
  if (logs.length === 0) {
    return { chart: [], summary: null };
  }

  const realDaily = groupByDay(logs);
  const daily = interpolateDaily(realDaily);

  const chart: WeightChartPoint[] = daily.map((d, index) => {
    const peso = Math.round(d.weightKg * 1000);
    const prev = index > 0 ? daily[index - 1] : null;
    const prevPeso = prev ? Math.round(prev.weightKg * 1000) : null;
    const deltaG = prevPeso !== null ? peso - prevPeso : null;

    // Com 1 ponto por dia (interpolado quando necessário), o ponto 7 dias atrás
    // está exatamente em index - 7 (ou não existe, no início da série).
    const weekRefIndex = index - 7;
    const weekRef = weekRefIndex >= 0 ? daily[weekRefIndex] : null;
    const weekGrowthG = weekRef
      ? peso - Math.round(weekRef.weightKg * 1000)
      : null;

    return {
      date: format(d.date, "dd/MM"),
      peso,
      pesoKg: Number(d.weightKg.toFixed(3)),
      isInterpolated: d.isInterpolated,
      deltaG,
      weekGrowthG,
    };
  });

  const realPesos = realDaily.map((r) => Math.round(r.weightKg * 1000));
  const first = realDaily[0]!;
  const last = realDaily[realDaily.length - 1]!;
  const spanDays = Math.max(
    (last.date.getTime() - first.date.getTime()) / MS_PER_DAY,
    1
  );

  const trend = linearRegression(
    realDaily.map((r) => ({
      x: (r.date.getTime() - first.date.getTime()) / MS_PER_DAY,
      y: Math.round(r.weightKg * 1000),
    }))
  );

  const summary: WeightSummary = {
    avgG: Math.round(realPesos.reduce((s, p) => s + p, 0) / realPesos.length),
    minG: Math.min(...realPesos),
    maxG: Math.max(...realPesos),
    totalDeltaG:
      Math.round(last.weightKg * 1000) - Math.round(first.weightKg * 1000),
    weeklyGrowthG: Math.round(
      ((Math.round(last.weightKg * 1000) -
        Math.round(first.weightKg * 1000)) /
        spanDays) *
        7
    ),
    trendStartG: trend ? Math.round(trend.intercept) : null,
    trendEndG: trend
      ? Math.round(trend.intercept + trend.slope * spanDays)
      : null,
  };

  return { chart, summary };
}
```

Remova também a função antiga `findLogAboutDaysAgo` (linhas 112-136 do arquivo original) — substituída pela lógica interna acima.

- [ ] **Step 6: Rodar testes e confirmar 7 passando**

```bash
npx vitest run lib/db/metrics.test.ts
```

Esperado: `Test Files 1 passed (1) | Tests 7 passed (7)`.

- [ ] **Step 7: Type-check**

```bash
npm run type-check
```

Esperado: sem erros. Se `metrics-dashboard.tsx` reclamar de tipos novos (`isInterpolated`, `trendStartG`), deixar quebrado — Task A2 conserta.

- [ ] **Step 8: Commit**

```bash
git add lib/db/metrics.ts lib/db/metrics.test.ts
git commit -m "feat(metrics): interpolação diária de peso e linha de tendência

- buildWeightChartData agora emite 1 ponto por dia, marcando
  dias sem pesagem como isInterpolated=true
- WeightSummary ganha trendStartG/trendEndG via regressão linear
  sobre as pesagens reais
- Min/max/avg continuam usando só pesagens reais"
```

---

### Task A2: Componente `<WeightCurveCard>` com auto-zoom, área e dots customizados

**Files:**
- Create: `components/tracker/weight-curve-card.tsx`

- [ ] **Step 1: Criar `components/tracker/weight-curve-card.tsx`**

```tsx
"use client";

import {
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeightChartPoint, WeightSummary } from "@/lib/db/metrics";

interface WeightCurveCardProps {
  chart: WeightChartPoint[];
  summary: WeightSummary | null;
  title?: string;
  emptyMessage?: string;
}

function formatDeltaG(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}g`;
}

function formatKg(value: number): string {
  return `${value.toFixed(3)} kg`;
}

function computeYDomain(chart: WeightChartPoint[]): [number, number] | undefined {
  if (chart.length <= 1) return undefined;
  const pesos = chart.map((p) => p.peso);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const padding = Math.max(20, (max - min) * 0.1);
  const lower = Math.floor((min - padding) / 50) * 50;
  const upper = Math.ceil((max + padding) / 50) * 50;
  return [Math.max(0, lower), upper];
}

function WeightSummaryPanel({ summary }: { summary: WeightSummary }) {
  const items = [
    { label: "Média", value: `${summary.avgG}g` },
    { label: "Mínimo", value: `${summary.minG}g` },
    { label: "Máximo", value: `${summary.maxG}g` },
    {
      label: "Variação total",
      value: formatDeltaG(summary.totalDeltaG),
      highlight: summary.totalDeltaG !== 0,
      positive: summary.totalDeltaG > 0,
    },
    {
      label: "Cresc. semanal",
      value: formatDeltaG(summary.weeklyGrowthG),
      highlight: summary.weeklyGrowthG !== 0,
      positive: summary.weeklyGrowthG > 0,
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p
            className={`text-sm font-semibold ${
              item.highlight
                ? item.positive
                  ? "text-emerald-500"
                  : "text-rose-500"
                : ""
            }`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: WeightChartPoint;
}

function WeightDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.isInterpolated) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={2.5}
        fill="var(--background)"
        stroke="#a78bfa"
        strokeWidth={1.2}
      />
    );
  }
  return (
    <circle cx={cx} cy={cy} r={3.5} fill="#a78bfa" stroke="#fff" strokeWidth={0.8} />
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeightChartPoint }>;
  summary: WeightSummary | null;
  chart: WeightChartPoint[];
}

function WeightTooltip({ active, payload, summary, chart }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const idx = chart.findIndex((p) => p.date === point.date);
  const prevReal = chart.slice(0, idx).reverse().find((p) => !p.isInterpolated);
  const nextReal = chart.slice(idx + 1).find((p) => !p.isInterpolated);

  return (
    <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
      <p className="mb-2 font-semibold">{point.date}</p>
      <div className="space-y-1">
        {point.isInterpolated ? (
          <>
            <p>
              <span className="text-muted-foreground">Peso estimado: </span>
              <span className="font-medium">{point.peso}g</span>
              <span className="text-muted-foreground"> ({formatKg(point.pesoKg)})</span>
            </p>
            {prevReal && nextReal && (
              <p className="text-muted-foreground">
                Entre {prevReal.date} ({prevReal.peso}g) e {nextReal.date} ({nextReal.peso}g)
              </p>
            )}
          </>
        ) : (
          <>
            <p>
              <span className="text-muted-foreground">Peso: </span>
              <span className="font-medium">{point.peso}g</span>
              <span className="text-muted-foreground"> ({formatKg(point.pesoKg)})</span>
            </p>
            {point.deltaG !== null && (
              <p>
                <span className="text-muted-foreground">Vs dia anterior: </span>
                <span
                  className={
                    point.deltaG > 0
                      ? "font-medium text-emerald-500"
                      : point.deltaG < 0
                        ? "font-medium text-rose-500"
                        : "font-medium"
                  }
                >
                  {formatDeltaG(point.deltaG)}
                </span>
              </p>
            )}
          </>
        )}
        {point.weekGrowthG !== null && (
          <p>
            <span className="text-muted-foreground">Taxa semanal: </span>
            <span
              className={
                point.weekGrowthG > 0
                  ? "font-medium text-emerald-500"
                  : "font-medium"
              }
            >
              {formatDeltaG(point.weekGrowthG)}/sem
            </span>
          </p>
        )}
        {summary && (
          <>
            <hr className="my-1 border-border" />
            <p className="text-muted-foreground">
              Período — média {summary.avgG}g · min {summary.minG}g · max {summary.maxG}g
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function WeightCurveCard({
  chart,
  summary,
  title = "Curva de Peso (4 semanas)",
  emptyMessage = "Sem pesagens recentes",
}: WeightCurveCardProps) {
  if (chart.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  const yDomain = computeYDomain(chart);
  const trendData =
    summary?.trendStartG !== null && summary?.trendEndG !== null && chart.length >= 2
      ? [
          { date: chart[0]!.date, tendencia: summary.trendStartG },
          { date: chart[chart.length - 1]!.date, tendencia: summary.trendEndG },
        ]
      : null;

  const mergedData = chart.map((point) => {
    const trendPoint = trendData?.find((t) => t.date === point.date);
    return { ...point, tendencia: trendPoint?.tendencia };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {summary && <WeightSummaryPanel summary={summary} />}
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={mergedData}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}g`}
              domain={yDomain ?? [0, "auto"]}
            />
            <Tooltip
              content={<WeightTooltip summary={summary} chart={chart} />}
            />
            <Area
              type="monotone"
              dataKey="peso"
              stroke="none"
              fill="url(#weightGradient)"
              isAnimationActive={false}
            />
            {trendData && (
              <Line
                type="linear"
                dataKey="tendencia"
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                strokeOpacity={0.6}
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="peso"
              stroke="#a78bfa"
              strokeWidth={2.5}
              dot={(props) => <WeightDot {...props} />}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {yDomain && yDomain[0] > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Escala ajustada — eixo Y não inicia em 0g
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

Esperado: sem erros no novo arquivo. Erros em `metrics-dashboard.tsx` continuam aceitáveis até Task A3.

- [ ] **Step 3: Commit**

```bash
git add components/tracker/weight-curve-card.tsx
git commit -m "feat(tracker): novo WeightCurveCard com auto-zoom, área e tendência

Componente isolado do gráfico enriquecido, reutilizável em
dashboard e pet page. Renderiza pontos diferentes para pesagens
reais (cheios) vs. dias interpolados (vazados) e adiciona linha
de tendência tracejada."
```

---

### Task A3: Trocar `MetricsDashboard` + pet page para usar `<WeightCurveCard>`, deletar `weight-chart.tsx`

**Files:**
- Modify: `components/dashboard/metrics-dashboard.tsx:1-275` (remover bloco do peso, importar `WeightCurveCard`)
- Modify: `app/(dashboard)/pets/[petId]/page.tsx:9` (trocar import) e `:195` (trocar uso)
- Delete: `components/tracker/weight-chart.tsx`

- [ ] **Step 1: Substituir o card de peso em `metrics-dashboard.tsx`**

Em `components/dashboard/metrics-dashboard.tsx`:

1. Remover linhas 1-151 (imports antigos, `formatDeltaG`, `formatKg`, `WeightSummaryPanel`, `WeightChartTooltip`). Reimportar só o necessário:

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/tracker/circular-progress";
import { WaterProgress } from "@/components/tracker/water-progress";
import { WeightCurveCard } from "@/components/tracker/weight-curve-card";
import type { PetMetrics } from "@/lib/db/metrics";

interface MetricsDashboardProps {
  metrics: PetMetrics;
}
```

2. Dentro de `MetricsDashboard`, substituir o `<Card>` do peso (linhas 162-199 do original) por:

```tsx
<WeightCurveCard chart={metrics.weightChart} summary={metrics.weightSummary} />
```

- [ ] **Step 2: Atualizar pet page**

Em `app/(dashboard)/pets/[petId]/page.tsx`:

1. Linha 9, substituir o import:
```tsx
import { WeightCurveCard } from "@/components/tracker/weight-curve-card";
```

2. Adicionar import no topo (após outros imports):
```tsx
import { buildWeightChartData } from "@/lib/db/metrics";
```

3. Substituir a linha 195 (`<WeightChart petId={...} weightLogs={...} />`) por:
```tsx
{(() => {
  const { chart, summary } = buildWeightChartData(
    serialized.weightLogs.map((w) => ({
      loggedAt: new Date(w.loggedAt),
      weightKg: w.weightKg,
    }))
  );
  return (
    <WeightCurveCard
      chart={chart}
      summary={summary}
      title="Curva de Peso"
      emptyMessage="Nenhuma pesagem registrada ainda."
    />
  );
})()}
```

- [ ] **Step 3: Deletar componente antigo**

```bash
rm components/tracker/weight-chart.tsx
```

- [ ] **Step 4: Type-check e lint**

```bash
npm run type-check && npm run lint
```

Esperado: sem erros.

- [ ] **Step 5: Rodar dev e validar visualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000/dashboard` e `http://localhost:3000/pets/<algumId>`. Verificar que:
- Curva mostra pontos cheios para pesagens registradas e vazios para dias interpolados
- Linha tracejada verde aparece quando há ≥2 pesagens
- Eixo Y começa em valor ajustado (não em 0g) quando há ≥2 pontos
- Tooltip de dia interpolado mostra "Peso estimado: ... Entre DD/MM (XXg) e DD/MM (YYg)"

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/metrics-dashboard.tsx app/\(dashboard\)/pets/\[petId\]/page.tsx
git rm components/tracker/weight-chart.tsx
git commit -m "feat(tracker): unifica gráfico de peso entre dashboard e pet page

Substitui o WeightChart simples da pet page pelo WeightCurveCard
do dashboard, garantindo a mesma experiência enriquecida em ambos
os lugares. Calcula chart/summary on-the-fly na pet page a partir
dos weightLogs já carregados."
```

---

## Part B — Fundação de preferências por pet

### Task B1: Adicionar `Switch` do shadcn

**Files:**
- Create: `components/ui/switch.tsx`

- [ ] **Step 1: Instalar via shadcn CLI**

```bash
npx shadcn@latest add switch
```

- [ ] **Step 2: Confirmar o arquivo**

```bash
ls components/ui/switch.tsx
```

Esperado: arquivo presente, conteúdo é o componente Switch do Radix wrapped com Tailwind.

- [ ] **Step 3: Commit**

```bash
git add components/ui/switch.tsx package.json package-lock.json
git commit -m "chore(ui): adiciona shadcn Switch"
```

---

### Task B2: Modelo `PetPreferences` em Prisma + migration com backfill

**Files:**
- Modify: `prisma/schema.prisma` (final do arquivo, após `WaterLog`)
- Modify: `prisma/schema.prisma:97-113` (adicionar relation em `Pet`)
- Create: `prisma/migrations/<timestamp>_pet_preferences/migration.sql`

- [ ] **Step 1: Adicionar modelo em `prisma/schema.prisma`**

No final do arquivo (após o modelo `WaterLog`):

```prisma
// ==============================================================
// DOMAIN — Preferências de tracking por pet (Fase 5)
// ==============================================================

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

- [ ] **Step 2: Adicionar relation em `Pet`**

Em `prisma/schema.prisma:97-113` (modelo `Pet`), adicionar antes do `@@index([userId])`:

```prisma
  preferences     PetPreferences?
```

- [ ] **Step 3: Criar a migration sem aplicar**

```bash
npx prisma migrate dev --create-only --name pet_preferences
```

Isso gera `prisma/migrations/<ts>_pet_preferences/migration.sql` com `CREATE TABLE` mas ainda não aplica.

- [ ] **Step 4: Editar a migration para adicionar backfill**

Abrir o arquivo gerado e adicionar ao final do SQL:

```sql
-- Backfill: cria preferências defaults (todos os toggles true) para pets existentes
INSERT INTO "pet_preferences" (
  "id", "petId",
  "trackNutrition", "trackHydration", "trackSymptoms",
  "trackDeworming", "trackVaccines", "trackVetVisits",
  "createdAt", "updatedAt"
)
SELECT
  'cprefs_' || substr(md5(random()::text), 1, 20),
  "id",
  true, true, true, true, true, true,
  NOW(), NOW()
FROM "pets";
```

- [ ] **Step 5: Aplicar a migration editada**

```bash
npx prisma migrate dev
```

Sem flags, pega a migration pendente (criada no step 3, editada no step 4) e aplica no DB de dev, incluindo o backfill. Em produção, `prisma migrate deploy` faz o mesmo.

- [ ] **Step 6: Regenerar Prisma client e type-check**

```bash
npx prisma generate
npm run type-check
```

Esperado: sem erros — nenhum código usa `PetPreferences` ainda.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): modelo PetPreferences com backfill de defaults

Cada pet ganha 1 registro de preferências com os 6 toggles
em true (preserva comportamento atual). Migração inclui INSERT
para pets pré-existentes."
```

---

### Task B3: Helper `getPetPreferences` com testes

**Files:**
- Create: `lib/db/preferences.ts`
- Create: `lib/db/preferences.test.ts`

- [ ] **Step 1: Criar `lib/db/preferences.ts`**

```ts
import { prisma } from "@/lib/db/client";
import type { PetPreferences } from "@prisma/client";

export const PREF_KEYS = [
  "trackNutrition",
  "trackHydration",
  "trackSymptoms",
  "trackDeworming",
  "trackVaccines",
  "trackVetVisits",
] as const;

export type PrefKey = (typeof PREF_KEYS)[number];

export type ResolvedPreferences = Record<PrefKey, boolean>;

export const DEFAULT_PREFS: ResolvedPreferences = {
  trackNutrition: true,
  trackHydration: true,
  trackSymptoms: true,
  trackDeworming: true,
  trackVaccines: true,
  trackVetVisits: true,
};

export function resolvePreferences(
  found: Pick<PetPreferences, PrefKey> | null | undefined
): ResolvedPreferences {
  if (!found) return { ...DEFAULT_PREFS };
  return PREF_KEYS.reduce((acc, key) => {
    acc[key] = found[key];
    return acc;
  }, {} as ResolvedPreferences);
}

export async function getPetPreferences(
  petId: string
): Promise<ResolvedPreferences> {
  const found = await prisma.petPreferences.findUnique({
    where: { petId },
    select: {
      trackNutrition: true,
      trackHydration: true,
      trackSymptoms: true,
      trackDeworming: true,
      trackVaccines: true,
      trackVetVisits: true,
    },
  });
  return resolvePreferences(found);
}
```

- [ ] **Step 2: Criar `lib/db/preferences.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, resolvePreferences } from "./preferences";

describe("resolvePreferences", () => {
  it("retorna defaults quando registro é null", () => {
    expect(resolvePreferences(null)).toEqual(DEFAULT_PREFS);
  });

  it("retorna defaults quando registro é undefined", () => {
    expect(resolvePreferences(undefined)).toEqual(DEFAULT_PREFS);
  });

  it("mapeia os 6 toggles do registro", () => {
    const stored = {
      trackNutrition: false,
      trackHydration: true,
      trackSymptoms: false,
      trackDeworming: true,
      trackVaccines: false,
      trackVetVisits: true,
    };
    expect(resolvePreferences(stored)).toEqual(stored);
  });

  it("DEFAULT_PREFS tem todos os 6 campos em true", () => {
    expect(Object.values(DEFAULT_PREFS).every((v) => v === true)).toBe(true);
    expect(Object.keys(DEFAULT_PREFS)).toHaveLength(6);
  });
});
```

- [ ] **Step 3: Rodar testes**

```bash
npx vitest run lib/db/preferences.test.ts
```

Esperado: 4 testes passando.

- [ ] **Step 4: Commit**

```bash
git add lib/db/preferences.ts lib/db/preferences.test.ts
git commit -m "feat(db): helper getPetPreferences com fallback para defaults

Quando o pet não tem registro em pet_preferences (caso raro
pós-backfill, ou pet criado no instante entre migration e deploy),
retorna os defaults com todos os toggles true."
```

---

### Task B4: Página `/pets/[id]/settings` + form + server action

**Files:**
- Create: `lib/actions/preferences.actions.ts`
- Create: `app/(dashboard)/pets/[petId]/settings/page.tsx`
- Create: `components/pets/tracking-preferences-form.tsx`

- [ ] **Step 1: Criar a server action**

`lib/actions/preferences.actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { userIsPetOwner } from "@/lib/db/access";

const updateSchema = z.object({
  petId: z.string().min(1),
  trackNutrition: z.boolean(),
  trackHydration: z.boolean(),
  trackSymptoms: z.boolean(),
  trackDeworming: z.boolean(),
  trackVaccines: z.boolean(),
  trackVetVisits: z.boolean(),
});

export async function updatePetPreferences(input: z.infer<typeof updateSchema>) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Não autenticado" } as const;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" } as const;

  const isOwner = await userIsPetOwner(parsed.data.petId, userId);
  if (!isOwner) {
    return { error: "Apenas o dono do pet pode mudar as configurações" } as const;
  }

  const { petId, ...prefs } = parsed.data;
  await prisma.petPreferences.upsert({
    where: { petId },
    create: { petId, ...prefs },
    update: prefs,
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath(`/pets/${petId}/settings`);
  revalidatePath(`/dashboard`);

  return { success: true } as const;
}
```

- [ ] **Step 2: Criar o form (client)**

`components/pets/tracking-preferences-form.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updatePetPreferences } from "@/lib/actions/preferences.actions";
import type { ResolvedPreferences, PrefKey } from "@/lib/db/preferences";

interface TrackingPreferencesFormProps {
  petId: string;
  initial: ResolvedPreferences;
}

const TOGGLE_META: Array<{
  key: PrefKey;
  emoji: string;
  label: string;
  desc: string;
}> = [
  {
    key: "trackNutrition",
    emoji: "🍽️",
    label: "Nutrição",
    desc: "Plano alimentar, refeições e Score do Dia",
  },
  {
    key: "trackHydration",
    emoji: "🚰",
    label: "Hidratação",
    desc: "Meta diária e log de água",
  },
  {
    key: "trackSymptoms",
    emoji: "📝",
    label: "Sintomas / observações",
    desc: "Registros clínicos do dia a dia",
  },
  {
    key: "trackDeworming",
    emoji: "💊",
    label: "Vermifugação",
    desc: "Aplicações e próximas doses",
  },
  {
    key: "trackVaccines",
    emoji: "💉",
    label: "Vacinas",
    desc: "Calendário vacinal",
  },
  {
    key: "trackVetVisits",
    emoji: "🏥",
    label: "Consultas vet",
    desc: "Agenda de consultas",
  },
];

export function TrackingPreferencesForm({
  petId,
  initial,
}: TrackingPreferencesFormProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ResolvedPreferences>(initial);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: PrefKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePetPreferences({ petId, ...prefs });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Configurações salvas");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <div className="flex items-center justify-between py-3 opacity-60">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚖️</span>
            <div>
              <p className="text-sm font-medium">Peso & crescimento</p>
              <p className="text-xs text-muted-foreground">
                Sempre ativo (base dos cálculos de água e dieta)
              </p>
            </div>
          </div>
          <Switch checked disabled />
        </div>
        {TOGGLE_META.map(({ key, emoji, label, desc }) => (
          <div
            key={key}
            className="flex items-center justify-between border-t py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{emoji}</span>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(v) => handleToggle(key, v)}
              disabled={isPending}
            />
          </div>
        ))}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Criar a página (server)**

`app/(dashboard)/pets/[petId]/settings/page.tsx`:

```tsx
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userIsPetOwner } from "@/lib/db/access";
import { getPetPreferences } from "@/lib/db/preferences";
import { TrackingPreferencesForm } from "@/components/pets/tracking-preferences-form";

interface SettingsPageProps {
  params: Promise<{ petId: string }>;
}

export const metadata: Metadata = {
  title: "Configurar tracking",
};

export default async function PetSettingsPage({ params }: SettingsPageProps) {
  const { petId } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect("/login");

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { id: true, name: true },
  });
  if (!pet) notFound();

  const isOwner = await userIsPetOwner(petId, userId);
  if (!isOwner) {
    redirect(`/pets/${petId}?error=owner-only`);
  }

  const preferences = await getPetPreferences(petId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/pets/${petId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para {pet.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Configurar tracking</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o que você quer acompanhar do {pet.name}. Dados antigos
          ficam preservados — só somem da UI.
        </p>
      </div>
      <TrackingPreferencesForm petId={petId} initial={preferences} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check e validar manualmente**

```bash
npm run type-check
npm run dev
```

Abrir `http://localhost:3000/pets/<algumId>/settings` logado como o dono → ver 6 toggles. Trocar 1 toggle → clicar Salvar → toast "Configurações salvas".

Abrir a mesma URL com outra conta (CAREGIVER) → redireciona para `/pets/<id>?error=owner-only`.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/preferences.actions.ts app/\(dashboard\)/pets/\[petId\]/settings components/pets/tracking-preferences-form.tsx
git commit -m "feat(prefs): página /pets/[id]/settings com 6 toggles

Apenas o dono do pet acessa (caregivers/viewers são redirecionados).
Form usa useTransition + server action upsert, com revalidação
de dashboard e pet page."
```

---

## Part C — Wire cascade

### Task C1: Incluir `preferences` no `serializePet` e em `PetMetrics`

**Files:**
- Modify: `lib/db/pets.ts:31-72` (include em `getPetById`) e `lib/db/pets.ts:120-229` (`serializePet`)
- Modify: `lib/db/metrics.ts` (`PetMetrics` interface + `getMetricsForPet` retorno)

`app/(dashboard)/dashboard/page.tsx` não muda — já passa `metrics` para `<MetricsDashboard>`, e `metrics.preferences` chega junto.

- [ ] **Step 1: Adicionar import + include em `lib/db/pets.ts`**

No topo, junto dos outros imports:

```ts
import { resolvePreferences } from "@/lib/db/preferences";
```

Em `getPetById` (linhas 31-72), adicionar `preferences: true` dentro do `include` (entre `vaccines` e o `}` final do include):

```ts
      vaccines: {
        orderBy: { appliedAt: "desc" },
      },
      preferences: true,
    },
```

- [ ] **Step 2: Mapear `preferences` em `serializePet`**

No `serializePet` (linha 120), adicionar como último campo do objeto retornado (após `mealLogs`, antes do `}` final):

```ts
    preferences: resolvePreferences(pet.preferences),
  };
}
```

`SerializedPet` é inferido automaticamente do retorno de `serializePet`, então o campo aparece sem precisar editar tipos explícitos.

- [ ] **Step 3: Atualizar `PetMetrics` e `getMetricsForPet` em `lib/db/metrics.ts`**

Em `PetMetrics` (linhas 22-34), adicionar:
```ts
preferences: ResolvedPreferences;
```

Importar `getPetPreferences` e `ResolvedPreferences` no topo:
```ts
import { getPetPreferences, type ResolvedPreferences } from "@/lib/db/preferences";
```

Em `getMetricsForPet`, antes do `return` final, adicionar:
```ts
const preferences = await getPetPreferences(petId);
```

E no objeto retornado, adicionar:
```ts
preferences,
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

Esperado: sem erros. Componentes que recebem `metrics` agora acessam `metrics.preferences`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/pets.ts lib/db/metrics.ts
git commit -m "feat(prefs): carrega preferences nas serializações de pet e metrics

Permite que UIs ramifiquem rendering com base nos 6 toggles sem
fazer query extra por componente."
```

---

### Task C2: Cascade nos cards do `MetricsDashboard`

**Files:**
- Modify: `components/dashboard/metrics-dashboard.tsx`

- [ ] **Step 1: Substituir o corpo de `MetricsDashboard`**

Em `components/dashboard/metrics-dashboard.tsx`, substituir a função `MetricsDashboard` inteira (deixando intactos os imports do Task A3):

```tsx
export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const prefs = metrics.preferences;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Métricas — {metrics.petName}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeightCurveCard chart={metrics.weightChart} summary={metrics.weightSummary} />

        {prefs.trackNutrition && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Refeições por Dia (7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={metrics.mealsChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="refeicoes" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {prefs.trackHydration && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Hidratação (7 dias vs meta)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={metrics.waterChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}ml`} />
                  <Tooltip formatter={(v) => [`${Number(v)} ml`, "Consumido"]} />
                  <ReferenceLine
                    y={metrics.waterGoalMl}
                    stroke="#f97316"
                    strokeDasharray="4 4"
                    label={{ value: "Meta", position: "right", fontSize: 10 }}
                  />
                  <Bar dataKey="ml" radius={[4, 4, 0, 0]}>
                    {metrics.waterChart.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.ml >= entry.meta ? "#22c55e" : "#7c3aed"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {prefs.trackNutrition && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Score do Dia</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <CircularProgress
                  percent={metrics.dailyScore}
                  primaryLabel={`${metrics.dailyScore}%`}
                  secondaryLabel="refeições hoje"
                  primaryClassName="text-3xl font-bold"
                />
                <p className="text-sm text-muted-foreground">Meta calórica hoje</p>
              </div>
              {prefs.trackHydration && (
                <WaterProgress
                  consumedMl={metrics.waterTodayMl}
                  goalMl={metrics.waterGoalMl}
                  isKitten={metrics.isKitten}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check e validação manual**

```bash
npm run type-check
npm run dev
```

Abrir `/dashboard`, abrir `/pets/<id>/settings`, desligar "Nutrição" → voltar pro dashboard → cards "Refeições por Dia" e "Score do Dia" sumiram. Religar e religar Hidratação → mesma coisa.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/metrics-dashboard.tsx
git commit -m "feat(prefs): cascade dos cards do dashboard nas preferências

Cards de Refeições, Hidratação e Score do Dia agora respeitam
trackNutrition/trackHydration. Layout grid se adapta quando
cards somem."
```

---

### Task C3: Cascade na pet page (tabs, hidratação, daily status) + filtragem na HealthTimeline + botão ⚙️

**Files:**
- Modify: `app/(dashboard)/pets/[petId]/page.tsx`
- Modify: `components/health/health-timeline.tsx`

- [ ] **Step 1: Botão ⚙️ no header da pet page**

Em `app/(dashboard)/pets/[petId]/page.tsx`, no bloco `{isOwner && (...)}` (linha 148):

```tsx
{isOwner && (
  <div className="flex flex-wrap justify-end gap-2">
    <Button asChild variant="outline" size="sm">
      <Link href={`/api/pets/${petId}/report`} target="_blank">
        Exportar PDF
      </Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href={`/pets/${petId}/members`}>Família</Link>
    </Button>
    <Button asChild variant="outline" size="sm">
      <Link href={`/pets/${petId}/settings`}>⚙️ Configurar tracking</Link>
    </Button>
  </div>
)}
```

- [ ] **Step 2: Declarar variáveis de preferências no topo do componente**

Em `app/(dashboard)/pets/[petId]/page.tsx`, dentro de `PetPage`, logo após `const waterSummary = await getWaterSummaryForPet(...)` (linha 73), adicionar:

```tsx
const prefs = serialized.preferences;
const showHealthTab =
  prefs.trackSymptoms ||
  prefs.trackDeworming ||
  prefs.trackVaccines ||
  prefs.trackVetVisits;
```

- [ ] **Step 3: Condicionar o `<DailyStatusScreen>`**

Substituir a linha 146:

```tsx
{activePlan && <DailyStatusScreen pet={serialized} canMutate={canMutate} />}
```

Por:

```tsx
{prefs.trackNutrition && activePlan && <DailyStatusScreen pet={serialized} canMutate={canMutate} />}
```

- [ ] **Step 4: Substituir o bloco `<Tabs>...</Tabs>` inteiro**

Substituir o bloco que vai de `<Tabs defaultValue="nutrition">` (linha 162) até o `</Tabs>` final (linha 283) por:

```tsx
<Tabs defaultValue={prefs.trackNutrition ? "nutrition" : "overview"}>
  <TabsList className="w-full overflow-x-auto flex-nowrap justify-start sm:w-auto">
    <TabsTrigger value="overview">📈 Crescimento</TabsTrigger>
    {prefs.trackNutrition && (
      <TabsTrigger value="nutrition">🍽️ Nutrição</TabsTrigger>
    )}
    {showHealthTab && <TabsTrigger value="health">🩺 Saúde</TabsTrigger>}
  </TabsList>

  <TabsContent value="overview" className="space-y-4 pt-4">
    <LogWeightForm petId={serialized.id} />
    {prefs.trackHydration && waterSummary && (
      <Card>
        <CardContent className="pt-6 pb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4 text-center">
            Hidratação hoje
          </p>
          <WaterProgress
            consumedMl={waterSummary.waterTodayMl}
            goalMl={waterSummary.waterGoalMl}
            isKitten={waterSummary.isKitten}
          />
          {canMutate && (
            <div className="mt-4 flex justify-center">
              <LogWaterForm
                petId={serialized.id}
                waterGoalMl={waterSummary.waterGoalMl}
                isKitten={waterSummary.isKitten}
              />
            </div>
          )}
        </CardContent>
      </Card>
    )}
    {(() => {
      const { chart, summary } = buildWeightChartData(
        serialized.weightLogs.map((w) => ({
          loggedAt: new Date(w.loggedAt),
          weightKg: w.weightKg,
        }))
      );
      return (
        <WeightCurveCard
          chart={chart}
          summary={summary}
          title="Curva de Peso"
          emptyMessage="Nenhuma pesagem registrada ainda."
        />
      );
    })()}

    {serialized.weightLogs.length > 0 && (
      <Card>
        <CardContent className="pt-4 pb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Histórico de pesagens
          </p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {[...serialized.weightLogs].reverse().map((log, i) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs w-5 text-right">
                    {i === 0 ? "🔴" : ""}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(log.loggedAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {log.notes && (
                    <span className="text-xs text-muted-foreground italic truncate max-w-[140px]">
                      {log.notes}
                    </span>
                  )}
                  <span className="font-semibold tabular-nums">
                    {(log.weightKg * 1000).toFixed(0)}g
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
  </TabsContent>

  {prefs.trackNutrition && (
    <TabsContent value="nutrition" className="space-y-4 pt-4">
      {!activePlan ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed p-6 text-center space-y-2">
            <p className="text-2xl">🥣</p>
            <p className="font-medium">Nenhum plano alimentar configurado</p>
            <p className="text-sm text-muted-foreground">
              Crie um plano para calcular automaticamente as necessidades calóricas do {serialized.name}.
            </p>
          </div>
          <CreateDietPlanForm
            petId={serialized.id}
            currentWeightKg={lastWeight?.weightKg}
          />
        </div>
      ) : (
        <>
          <NutritionSummary pet={serialized} />
          <div className="flex flex-wrap gap-2">
            <AddDietItemForm
              dietPlanId={activePlan.id}
              nedKcal={activePlan.nedKcal}
              mealsPerDay={activePlan.mealsPerDay}
            />
            <CreateDietPlanForm
              petId={serialized.id}
              currentWeightKg={lastWeight?.weightKg}
            />
          </div>
        </>
      )}
    </TabsContent>
  )}

  {showHealthTab && (
    <TabsContent value="health" className="space-y-4 pt-4">
      <HealthTimeline pet={serialized} />
      {canMutate && (
        <div className="flex flex-wrap gap-2">
          {prefs.trackSymptoms && <AddHealthLogForm petId={serialized.id} />}
          {prefs.trackVetVisits && <AddVetAppointmentForm petId={serialized.id} />}
          {prefs.trackDeworming && <AddDewormingForm petId={serialized.id} />}
          {prefs.trackVaccines && <AddVaccineForm petId={serialized.id} />}
        </div>
      )}
      {prefs.trackVetVisits && (
        <VetAppointmentList
          appointments={serialized.vetAppointments}
          canMutate={canMutate}
        />
      )}
      {prefs.trackDeworming && (
        <DewormingList dewormings={serialized.dewormings} />
      )}
      {prefs.trackVaccines && <VaccineList vaccines={serialized.vaccines} />}
      {prefs.trackSymptoms && (
        <HealthLogList petId={serialized.id} healthLogs={serialized.healthLogs} />
      )}
    </TabsContent>
  )}
</Tabs>
```

- [ ] **Step 5: Filtrar `HealthTimeline` por preferences**

Substituir a função `HealthTimeline` inteira em `components/health/health-timeline.tsx` (mantendo os imports e o type `TimelineEvent` do topo do arquivo):

```tsx
export function HealthTimeline({ pet }: HealthTimelineProps) {
  const prefs = pet.preferences;
  const events: TimelineEvent[] = [
    ...(prefs.trackSymptoms ? pet.healthLogs : []).map((log) => ({
      id: `health-${log.id}`,
      date: log.occurredAt,
      type: "Log clínico",
      title: log.description,
      subtitle: `${log.type} · ${log.severity}`,
      icon: "🩺",
    })),
    ...(prefs.trackVetVisits ? pet.vetAppointments : []).map((apt) => ({
      id: `vet-${apt.id}`,
      date: apt.scheduledAt,
      type: "Consulta",
      title: apt.title,
      subtitle: apt.status,
      icon: "🏥",
    })),
    ...(prefs.trackDeworming ? pet.dewormings : []).map((d) => ({
      id: `dew-${d.id}`,
      date: d.appliedAt,
      type: "Vermifugação",
      title: d.product,
      subtitle: d.nextDueAt ? `Próxima: ${formatDate(d.nextDueAt)}` : undefined,
      icon: "💊",
    })),
    ...(prefs.trackVaccines ? pet.vaccines : []).map((v) => ({
      id: `vac-${v.id}`,
      date: v.appliedAt,
      type: "Vacina",
      title: v.name,
      subtitle: v.nextDueAt ? `Reforço: ${formatDate(v.nextDueAt)}` : undefined,
      icon: "💉",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum evento de saúde registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm">
              {event.icon}
            </div>
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-border min-h-[24px]" />
            )}
          </div>
          <div className="pb-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(event.date)}</span>
              <span>·</span>
              <span>{event.type}</span>
            </div>
            <p className="font-medium mt-0.5">{event.title}</p>
            {event.subtitle && (
              <p className="text-sm text-muted-foreground">{event.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Type-check e validação manual**

```bash
npm run type-check
npm run dev
```

Em `/pets/<id>/settings`:
- Desligar **Nutrição** → tab Nutrição some, DailyStatusScreen some.
- Desligar **Hidratação** → bloco "Hidratação hoje" da tab Crescimento some.
- Desligar **Sintomas, Vermifugação, Vacinas e Consultas vet** (todos os 4) → tab Saúde inteira some.
- Desligar só **Vacinas** → tab Saúde fica, mas `<VaccineList>` e `<AddVaccineForm>` somem.

- [ ] **Step 7: Commit**

```bash
git add app/\(dashboard\)/pets/\[petId\]/page.tsx components/health/health-timeline.tsx
git commit -m "feat(prefs): cascade na pet page e timeline + botão ⚙️ no header

Tabs Nutrição/Saúde, blocos Hidratação/DailyStatus e listas
clínicas dentro de Saúde respeitam os 6 toggles. HealthTimeline
filtra eventos pelas preferences. Botão Configurar tracking
visível só pro dono."
```

---

### Task C4: E2E test do fluxo de toggle

**Files:**
- Create: `e2e/tracking-preferences.spec.ts`

- [ ] **Step 1: Criar o arquivo de teste**

`e2e/tracking-preferences.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

async function loginE2E(page: Page) {
  await page.goto("/api/e2e/login");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

async function createBasicPet(page: Page, name: string): Promise<string> {
  await page.goto("/pets/new");
  await page.getByLabel("Nome *").fill(name);
  await page.getByRole("button", { name: "Cadastrar Pet" }).click();
  await expect(page).toHaveURL(/\/pets\/(?!new)[^/]+$/, { timeout: 15000 });
  const petId = page.url().match(/\/pets\/([^/]+)/)?.[1];
  if (!petId || petId === "new") throw new Error("Pet ID inválido");
  return petId;
}

test.describe("Tracking preferences", () => {
  test("dono consegue desligar Hidratação e o bloco some da pet page", async ({ page }) => {
    await loginE2E(page);
    const petId = await createBasicPet(page, "Teste Prefs Hidratação");

    await page.goto(`/pets/${petId}/settings`);
    await expect(page.getByRole("heading", { name: "Configurar tracking" })).toBeVisible();

    const hydrationRow = page.locator("p", { hasText: "Hidratação" }).first().locator("..").locator("..");
    await hydrationRow.getByRole("switch").click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();

    await page.goto(`/pets/${petId}`);
    await page.getByRole("tab", { name: /Crescimento/ }).click();
    await expect(page.getByText("Hidratação hoje")).toHaveCount(0);
  });

  test("desligar os 4 toggles clínicos esconde a tab Saúde", async ({ page }) => {
    await loginE2E(page);
    const petId = await createBasicPet(page, "Teste Prefs Saúde");

    await page.goto(`/pets/${petId}/settings`);
    for (const label of ["Sintomas / observações", "Vermifugação", "Vacinas", "Consultas vet"]) {
      const row = page.locator("p", { hasText: label }).first().locator("..").locator("..");
      await row.getByRole("switch").click();
    }
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();

    await page.goto(`/pets/${petId}`);
    await expect(page.getByRole("tab", { name: /Saúde/ })).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Rodar o E2E**

```bash
npx playwright test e2e/tracking-preferences.spec.ts
```

Esperado: 2 testes passando.

- [ ] **Step 3: Commit**

```bash
git add e2e/tracking-preferences.spec.ts
git commit -m "test(e2e): smoke do toggle de preferências de tracking

Cobre 2 fluxos: desligar Hidratação esconde o bloco da tab
Crescimento; desligar os 4 toggles clínicos esconde a tab
Saúde inteira."
```

---

## Self-Review checklist (já realizado pelo autor do plano)

Cobertura da spec verificada — cada seção do design mapeia para uma task acima:

- Spec 1.1 (auto-zoom) → A2 (`computeYDomain`)
- Spec 1.2 (tendência) → A1 (regressão) + A2 (render)
- Spec 1.3 (área) → A2 (`<Area>` + `linearGradient`)
- Spec 1.4 (interpolação diária + dots vs/dashed) → A1 + A2 (`WeightDot`, tooltip ramificado)
- Spec 1.5 (médias/min/max só de reais) → A1 (`summary` calculado de `realPesos`)
- Spec 1.6 (histórico só real) → mantido como está; o `weightLogs` original passa pelo `serialized` (não afetado)
- Spec 1.7 (unificar gráficos) → A3
- Spec 2.1 (modelo de dados + backfill) → B2 + B3
- Spec 2.2 (página de configurações) → B4
- Spec 2.3 (botão no header) → C3 step 1
- Spec 2.4 (tabela de cascade) → C2 + C3
- Spec 2.5 (dashboard cards) → C2

Nenhum step com TBD/TODO/placeholder. Identificadores cruzados (`PrefKey`, `ResolvedPreferences`, `DEFAULT_PREFS`, `getPetPreferences`, `resolvePreferences`, `updatePetPreferences`, `WeightCurveCard`, `buildWeightChartData`) batem entre as tasks que os definem e as que os consomem.
