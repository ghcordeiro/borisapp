"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import {
  calculateNutritionPlan,
  calculateGramsForKcal,
  type LifeStage,
} from "@/lib/nutrition/formulas";

// ─── Schemas de Validação ─────────────────────────────────────────────────────

const CreateDietPlanSchema = z.object({
  petId: z.string().cuid(),
  weightKg: z.number().positive("Peso deve ser positivo"),
  lifeStage: z.enum([
    "KITTEN",
    "KITTEN_LARGE",
    "ADULT_INTACT",
    "ADULT_NEUTERED",
    "PREGNANT",
    "LACTATING",
    "SENIOR",
    "WEIGHT_LOSS",
    "WEIGHT_GAIN",
  ]),
  mealsPerDay: z.number().int().min(2).max(6).default(4),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().optional(),
});

const AddDietItemSchema = z.object({
  dietPlanId: z.string().cuid(),
  name: z.string().min(1).max(100),
  type: z.enum(["KIBBLE", "WET_FOOD", "SUPPLEMENT", "TREAT", "OTHER"]),
  kcalPer100g: z.number().positive("Calorias devem ser positivas"),
  percentageOfDiet: z
    .number()
    .min(1)
    .max(100)
    .describe("Percentual do NED que esse item deve cobrir"),
});

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Cria um plano alimentar para um pet, calculando automaticamente
 * RER e NED com base no peso e estágio de vida.
 */
export async function createDietPlan(
  formData: z.infer<typeof CreateDietPlanSchema>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Não autenticado" };
  }

  const parsed = CreateDietPlanSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { petId, weightKg, lifeStage, mealsPerDay, wakeTime, sleepTime, notes } = parsed.data;

  // Verifica se o pet pertence ao usuário
  const pet = await prisma.pet.findUnique({
    where: { id: petId, userId: session.user.id },
  });

  if (!pet) {
    return { error: "Pet não encontrado" };
  }

  // Calcula RER e NED (já com distribuição horária personalizada)
  const nutrition = calculateNutritionPlan({
    weightKg,
    lifeStage: lifeStage as LifeStage,
    mealsPerDay,
    wakeTime,
    sleepTime,
  });

  // Desativa plano ativo anterior
  await prisma.dietPlan.updateMany({
    where: { petId, isActive: true },
    data: { isActive: false },
  });

  const dietPlan = await prisma.dietPlan.create({
    data: {
      petId,
      weightKg,
      rerKcal: nutrition.rerKcal,
      nedKcal: nutrition.nedKcal,
      energyFactor: nutrition.energyFactor,
      mealsPerDay,
      wakeTime: wakeTime ?? null,
      sleepTime: sleepTime ?? null,
      isActive: true,
      notes,
    },
  });

  revalidatePath(`/pets/${petId}`);
  return { data: { id: dietPlan.id, petId: dietPlan.petId }, nutrition };
}

/**
 * Adiciona um item de dieta ao plano e calcula automaticamente
 * as gramas diárias necessárias para atingir o percentual do NED.
 */
export async function addDietItem(
  formData: z.infer<typeof AddDietItemSchema>
) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Não autenticado" };
  }

  const parsed = AddDietItemSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { dietPlanId, name, type, kcalPer100g, percentageOfDiet } =
    parsed.data;

  // Verifica se o plano pertence a um pet do usuário
  const dietPlan = await prisma.dietPlan.findFirst({
    where: {
      id: dietPlanId,
      pet: { userId: session.user.id },
    },
  });

  if (!dietPlan) {
    return { error: "Plano alimentar não encontrado" };
  }

  // Calcula gramas necessárias
  const dailyKcalTarget =
    (Number(dietPlan.nedKcal) * percentageOfDiet) / 100;
  const dailyGrams = calculateGramsForKcal(dailyKcalTarget, kcalPer100g);

  const dietItem = await prisma.dietItem.create({
    data: {
      dietPlanId,
      name,
      type,
      kcalPer100g,
      dailyGrams,
    },
  });

  revalidatePath(`/pets/${dietPlan.petId}`);
  return {
    data: {
      id: dietItem.id,
      dietPlanId: dietItem.dietPlanId,
      name: dietItem.name,
      type: dietItem.type,
      kcalPer100g: Number(dietItem.kcalPer100g),
      dailyGrams: Number(dietItem.dailyGrams),
    },
    dailyGrams,
    dailyKcalTarget,
  };
}

/**
 * Retorna uma prévia do cálculo nutricional sem persistir no banco.
 * Útil para exibir feedback em tempo real no formulário.
 */
export async function previewNutritionPlan(input: {
  weightKg: number;
  lifeStage: LifeStage;
  mealsPerDay?: number;
}) {
  const schema = z.object({
    weightKg: z.number().positive(),
    lifeStage: z.string(),
    mealsPerDay: z.number().int().min(2).max(6).optional(),
  });

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: "Dados inválidos para preview" };
  }

  const nutrition = calculateNutritionPlan({
    weightKg: input.weightKg,
    lifeStage: input.lifeStage,
    mealsPerDay: input.mealsPerDay,
  });

  return { data: nutrition };
}
