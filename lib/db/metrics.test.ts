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
