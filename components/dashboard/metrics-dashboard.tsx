"use client";

import {
  LineChart,
  Line,
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
import type { PetMetrics, WeightChartPoint, WeightSummary } from "@/lib/db/metrics";

interface MetricsDashboardProps {
  metrics: PetMetrics;
}

interface WeightChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: WeightChartPoint }>;
  summary: WeightSummary | null;
}

function formatDeltaG(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}g`;
}

function formatKg(value: number): string {
  return `${value.toFixed(3)} kg`;
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
        <div
          key={item.label}
          className="rounded-lg border bg-muted/30 px-3 py-2"
        >
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

function WeightChartTooltip({
  active,
  payload,
  summary,
}: WeightChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as WeightChartPoint | undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur">
      <p className="mb-2 font-semibold">{point.date}</p>
      <div className="space-y-1">
        <p>
          <span className="text-muted-foreground">Peso: </span>
          <span className="font-medium">{point.peso}g</span>
          <span className="text-muted-foreground"> ({formatKg(point.pesoKg)})</span>
        </p>
        {point.deltaG !== null ? (
          <p>
            <span className="text-muted-foreground">Vs anterior: </span>
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
        ) : (
          <p className="text-muted-foreground">Primeira medição do período</p>
        )}
        {point.weekGrowthG !== null && (
          <p>
            <span className="text-muted-foreground">Taxa semanal: </span>
            <span
              className={
                point.weekGrowthG > 0
                  ? "font-medium text-emerald-500"
                  : point.weekGrowthG < 0
                    ? "font-medium text-rose-500"
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
              Período — média {summary.avgG}g · min {summary.minG}g · max{" "}
              {summary.maxG}g
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Métricas — {metrics.petName}</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Curva de peso */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Curva de Peso (4 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.weightChart.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem pesagens recentes
              </p>
            ) : (
              <>
                {metrics.weightSummary && (
                  <WeightSummaryPanel summary={metrics.weightSummary} />
                )}
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={metrics.weightChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}g`} />
                    <Tooltip
                      content={
                        <WeightChartTooltip summary={metrics.weightSummary} />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="peso"
                      stroke="#7c3aed"
                      strokeWidth={2}
                      dot={{ fill: "#7c3aed", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>

        {/* Refeições/dia */}
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

        {/* Hidratação */}
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

        {/* Score do dia + água hoje */}
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
            <WaterProgress
              consumedMl={metrics.waterTodayMl}
              goalMl={metrics.waterGoalMl}
              isKitten={metrics.isKitten}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
