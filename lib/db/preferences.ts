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
