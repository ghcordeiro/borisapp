"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

interface WeightLog {
  id: string;
  // Prisma retorna Decimal, mas aceitamos qualquer coisa convertível em number
  weightKg: { toString(): string } | string | number;
  loggedAt: Date | string;
}

interface WeightChartProps {
  petId: string;
  weightLogs: WeightLog[];
}

export function WeightChart({ weightLogs }: WeightChartProps) {
  const data = weightLogs.map((log) => ({
    date: formatDate(log.loggedAt),
    peso: parseFloat(log.weightKg.toString()) * 1000, // Converter para gramas
    pesoKg: parseFloat(log.weightKg.toString()),
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curva de Peso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma pesagem registrada ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Curva de Peso</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              tickFormatter={(v) => `${v}g`}
            />
            <Tooltip
              formatter={(value: number) => [`${value}g`, "Peso"]}
            />
            <Line
              type="monotone"
              dataKey="peso"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={{ fill: "#7c3aed", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
