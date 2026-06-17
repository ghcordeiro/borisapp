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
    summary !== null &&
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
