/**
 * Testes unitários para o motor de nutrição.
 * Rodar com: npx vitest lib/nutrition/formulas.test.ts
 *
 * Valores de referência validados contra calculadoras veterinárias:
 * - https://wsava.org/global-guidelines/global-nutrition-guidelines/
 */

import { describe, expect, it } from "vitest";
import {
  calculateRER,
  calculateNED,
  calculateNutritionPlan,
  calculateGramsForKcal,
  distributeMeals,
} from "./formulas";

describe("calculateRER", () => {
  it("calcula corretamente para peso adulto típico (4 kg)", () => {
    // 70 × (4 ^ 0.75) = 70 × 2.828 ≈ 197.97
    expect(calculateRER(4)).toBeCloseTo(197.97, 1);
  });

  it("usa fórmula linear para filhote muito pequeno (0.4 kg)", () => {
    // 30 × 0.4 + 70 = 12 + 70 = 82
    expect(calculateRER(0.4)).toBeCloseTo(82, 0);
  });

  it("calcula para peso de filhote típico (0.45 kg)", () => {
    // Linear: 30 × 0.45 + 70 = 83.5
    expect(calculateRER(0.45)).toBeCloseTo(83.5, 0);
  });

  it("lança erro para peso zero", () => {
    expect(() => calculateRER(0)).toThrow();
  });

  it("lança erro para peso negativo", () => {
    expect(() => calculateRER(-1)).toThrow();
  });
});

describe("calculateNED", () => {
  it("aplica fator 2.5 para filhote", () => {
    const rer = calculateRER(0.45);
    const { nedKcal, energyFactor } = calculateNED(rer, "KITTEN");
    expect(energyFactor).toBe(2.5);
    expect(nedKcal).toBeCloseTo(rer * 2.5, 1);
  });

  it("aplica fator 1.2 para adulto castrado", () => {
    const rer = calculateRER(4);
    const { nedKcal, energyFactor } = calculateNED(rer, "ADULT_NEUTERED");
    expect(energyFactor).toBe(1.2);
    expect(nedKcal).toBeCloseTo(rer * 1.2, 1);
  });
});

describe("distributeMeals", () => {
  it("distribui 4 refeições iguais", () => {
    const meals = distributeMeals(100, 4);
    expect(meals).toHaveLength(4);
    const first = meals[0];
    const last = meals[3];
    expect(first?.kcal).toBe(25);
    expect(first?.scheduledTime).toBe("07:00");
    expect(last?.scheduledTime).toBe("21:00");
  });

  it("distribui 2 refeições", () => {
    const meals = distributeMeals(200, 2);
    expect(meals).toHaveLength(2);
    expect(meals[0]?.kcal).toBe(100);
  });
});

describe("calculateNutritionPlan", () => {
  it("gera plano completo para filhote de 450g", () => {
    const result = calculateNutritionPlan({
      weightKg: 0.45,
      lifeStage: "KITTEN",
      mealsPerDay: 4,
    });

    expect(result.weightInGrams).toBe(450);
    expect(result.rerKcal).toBeGreaterThan(0);
    expect(result.nedKcal).toBeGreaterThan(result.rerKcal);
    expect(result.mealDistribution).toHaveLength(4);
    expect(result.lifeStageLabel).toBe("Filhote (< 12 meses)");
  });
});

describe("calculateGramsForKcal", () => {
  it("calcula gramas para ração com 340 kcal/100g", () => {
    // 100 kcal ÷ 340 kcal/100g × 100 = 29.4g
    expect(calculateGramsForKcal(100, 340)).toBeCloseTo(29.4, 0);
  });

  it("lança erro para kcalPer100g zero", () => {
    expect(() => calculateGramsForKcal(100, 0)).toThrow();
  });
});
