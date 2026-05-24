import { prisma } from "@/lib/db/client";
import { getStartOfToday, getStartOfTomorrow } from "@/lib/db/date-utils";
import { petAccessibleWhere, petsAccessibleWhere } from "@/lib/db/access";
import { dateToIso, decimalToNumber } from "@/lib/db/decimal-utils";

/**
 * Busca todos os pets ativos de um usuário.
 * Inclui o último peso registrado para exibição no card.
 */
export async function getPetsByUser(userId: string) {
  return prisma.pet.findMany({
    where: petsAccessibleWhere(userId),
    include: {
      weightLogs: {
        orderBy: { loggedAt: "desc" },
        take: 1,
      },
      dietPlans: {
        where: { isActive: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Busca um pet específico com todos os dados necessários para a página de detalhes.
 * Valida o ownership via userId.
 */
export async function getPetById(petId: string, userId: string) {
  const startOfToday = getStartOfToday();
  const startOfTomorrow = getStartOfTomorrow(startOfToday);

  return prisma.pet.findFirst({
    where: petAccessibleWhere(petId, userId),
    include: {
      weightLogs: {
        orderBy: { loggedAt: "asc" },
      },
      dietPlans: {
        where: { isActive: true },
        include: {
          dietItems: true,
        },
        take: 1,
      },
      mealLogs: {
        where: {
          servedAt: { gte: startOfToday, lt: startOfTomorrow },
        },
        orderBy: { servedAt: "desc" },
        include: {
          servedBy: { select: { name: true } },
        },
      },
      healthLogs: {
        orderBy: { occurredAt: "desc" },
        take: 20,
      },
      vetAppointments: {
        orderBy: { scheduledAt: "desc" },
      },
      dewormings: {
        orderBy: { appliedAt: "desc" },
      },
      vaccines: {
        orderBy: { appliedAt: "desc" },
      },
    },
  });
}

export type PetWithDetails = NonNullable<Awaited<ReturnType<typeof getPetById>>>;
export type PetSummary = Awaited<ReturnType<typeof getPetsByUser>>[number];

export function serializePetSummary(pet: PetSummary) {
  return {
    id: pet.id,
    userId: pet.userId,
    name: pet.name,
    breed: pet.breed,
    birthDate: dateToIso(pet.birthDate),
    gender: pet.gender,
    imageUrl: pet.imageUrl,
    isActive: pet.isActive,
    notes: pet.notes,
    createdAt: pet.createdAt.toISOString(),
    updatedAt: pet.updatedAt.toISOString(),
    weightLogs: pet.weightLogs.map((w) => ({
      id: w.id,
      petId: w.petId,
      weightKg: decimalToNumber(w.weightKg),
      loggedAt: w.loggedAt.toISOString(),
      notes: w.notes,
    })),
    dietPlans: pet.dietPlans.map((dp) => ({
      id: dp.id,
      petId: dp.petId,
      weightKg: decimalToNumber(dp.weightKg),
      rerKcal: decimalToNumber(dp.rerKcal),
      nedKcal: decimalToNumber(dp.nedKcal),
      energyFactor: decimalToNumber(dp.energyFactor),
      mealsPerDay: dp.mealsPerDay,
      isActive: dp.isActive,
      wakeTime: dp.wakeTime,
      sleepTime: dp.sleepTime,
      notes: dp.notes,
      createdAt: dp.createdAt.toISOString(),
      updatedAt: dp.updatedAt.toISOString(),
    })),
  };
}

export type SerializedPetSummary = ReturnType<typeof serializePetSummary>;

/**
 * Serializa um PetWithDetails para plain objects passáveis a Client Components.
 */
export function serializePet(pet: PetWithDetails) {
  return {
    id: pet.id,
    userId: pet.userId,
    name: pet.name,
    breed: pet.breed,
    birthDate: dateToIso(pet.birthDate),
    gender: pet.gender,
    imageUrl: pet.imageUrl,
    isActive: pet.isActive,
    notes: pet.notes,
    createdAt: pet.createdAt.toISOString(),
    updatedAt: pet.updatedAt.toISOString(),
    weightLogs: pet.weightLogs.map((w) => ({
      id: w.id,
      petId: w.petId,
      weightKg: decimalToNumber(w.weightKg),
      loggedAt: w.loggedAt.toISOString(),
      notes: w.notes,
    })),
    dietPlans: pet.dietPlans.map((dp) => ({
      id: dp.id,
      petId: dp.petId,
      weightKg: decimalToNumber(dp.weightKg),
      rerKcal: decimalToNumber(dp.rerKcal),
      nedKcal: decimalToNumber(dp.nedKcal),
      energyFactor: decimalToNumber(dp.energyFactor),
      mealsPerDay: dp.mealsPerDay,
      isActive: dp.isActive,
      wakeTime: dp.wakeTime,
      sleepTime: dp.sleepTime,
      notes: dp.notes,
      createdAt: dp.createdAt.toISOString(),
      updatedAt: dp.updatedAt.toISOString(),
      dietItems: (dp.dietItems ?? []).map((item) => ({
        id: item.id,
        dietPlanId: item.dietPlanId,
        name: item.name,
        type: item.type,
        kcalPer100g: decimalToNumber(item.kcalPer100g),
        dailyGrams: decimalToNumber(item.dailyGrams),
        notes: item.notes,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    })),
    healthLogs: pet.healthLogs.map((log) => ({
      id: log.id,
      petId: log.petId,
      type: log.type,
      description: log.description,
      severity: log.severity,
      occurredAt: log.occurredAt.toISOString(),
      resolvedAt: dateToIso(log.resolvedAt),
      notes: log.notes,
      createdAt: log.createdAt.toISOString(),
      updatedAt: log.updatedAt.toISOString(),
    })),
    vetAppointments: pet.vetAppointments.map((apt) => ({
      id: apt.id,
      petId: apt.petId,
      title: apt.title,
      vetName: apt.vetName,
      clinicName: apt.clinicName,
      scheduledAt: apt.scheduledAt.toISOString(),
      completedAt: dateToIso(apt.completedAt),
      status: apt.status,
      notes: apt.notes,
      createdAt: apt.createdAt.toISOString(),
      updatedAt: apt.updatedAt.toISOString(),
    })),
    dewormings: pet.dewormings.map((d) => ({
      id: d.id,
      petId: d.petId,
      product: d.product,
      doseMg: d.doseMg != null ? decimalToNumber(d.doseMg) : null,
      appliedAt: d.appliedAt.toISOString(),
      nextDueAt: dateToIso(d.nextDueAt),
      notes: d.notes,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
    vaccines: pet.vaccines.map((v) => ({
      id: v.id,
      petId: v.petId,
      name: v.name,
      appliedAt: v.appliedAt.toISOString(),
      nextDueAt: dateToIso(v.nextDueAt),
      lotNumber: v.lotNumber,
      vetName: v.vetName,
      notes: v.notes,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    })),
    mealLogs: pet.mealLogs.map((ml) => ({
      id: ml.id,
      petId: ml.petId,
      dietPlanId: ml.dietPlanId,
      mealNumber: ml.mealNumber,
      scheduledTime: ml.scheduledTime,
      servedAt: ml.servedAt.toISOString(),
      servedByUserId: ml.servedByUserId,
      plannedGrams: decimalToNumber(ml.plannedGrams),
      actualGrams: ml.actualGrams != null ? decimalToNumber(ml.actualGrams) : null,
      notes: ml.notes,
      createdAt: ml.createdAt.toISOString(),
      servedBy: { name: ml.servedBy.name },
    })),
  };
}

export type SerializedPet = ReturnType<typeof serializePet>;
