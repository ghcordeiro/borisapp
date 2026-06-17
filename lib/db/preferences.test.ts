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
