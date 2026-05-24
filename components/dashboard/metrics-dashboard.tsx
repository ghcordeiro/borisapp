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
import type { PetMetrics } from "@/lib/db/metrics";

interface MetricsDashboardProps {
  metrics: PetMetrics;
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
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={metrics.weightChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}g`} />
                  <Tooltip formatter={(v: number) => [`${v}g`, "Peso"]} />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ fill: "#7c3aed", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
                <Tooltip formatter={(v: number) => [`${v} ml`, "Consumido"]} />
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
