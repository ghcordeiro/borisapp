"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getStartOfToday, getStartOfTomorrow } from "@/lib/db/date-utils";
import { userHasPetMutationAccess, userHasPetReadAccess } from "@/lib/db/access";
import { distributeMeals } from "@/lib/nutrition/formulas";

const LogMealSchema = z.object({
  petId: z.string().cuid(),
  dietPlanId: z.string().cuid(),
  mealNumber: z.number().int().min(1).max(6),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/),
  plannedGrams: z.number().positive(),
  actualGrams: z.number().positive().optional(),
  notes: z.string().optional(),
  servedAt: z.string().datetime().optional(),
});

export type MealStatus = "upcoming" | "due" | "served" | "missed";

export interface TodayMealStatus {
  plan: {
    id: string;
    mealsPerDay: number;
    nedKcal: number;
    wakeTime: string | null;
    sleepTime: string | null;
  };
  meals: Array<{
    mealNumber: number;
    scheduledTime: string;
    plannedGrams: number;
    status: MealStatus;
    servedAt: string | null;
    servedByName: string | null;
    minutesSinceLastMeal: number | null;
  }>;
  summary: {
    totalMeals: number;
    servedCount: number;
    pendingCount: number;
    lastServedAt: string | null;
    minutesSinceLastMeal: number | null;
    completionPercent: number;
  };
}

function getMealStatus(scheduledTime: string, servedAt: string | null): MealStatus {
  if (servedAt) return "served";

  const now = new Date();
  const [h = 0, m = 0] = scheduledTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);

  const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
  if (diffMin < 0) return "upcoming";
  if (diffMin <= 60) return "due";
  return "missed";
}

export async function logMeal(formData: z.infer<typeof LogMealSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = LogMealSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { petId, dietPlanId, mealNumber, scheduledTime, plannedGrams, actualGrams, notes, servedAt } =
    parsed.data;

  const hasAccess = await userHasPetMutationAccess(petId, session.user.id);
  if (!hasAccess) return { error: "Acesso negado" };

  const startOfToday = getStartOfToday();
  const startOfTomorrow = getStartOfTomorrow(startOfToday);

  if (servedAt) {
    const servedDate = new Date(servedAt);
    if (servedDate < startOfToday || servedDate >= startOfTomorrow) {
      return { error: "Horário deve ser de hoje" };
    }
    if (servedDate > new Date()) {
      return { error: "Horário não pode ser no futuro" };
    }
  }

  const existing = await prisma.mealLog.findFirst({
    where: {
      petId,
      mealNumber,
      servedAt: { gte: startOfToday, lt: startOfTomorrow },
    },
  });
  if (existing) return { error: "Refeição já registrada hoje" };

  const mealLog = await prisma.mealLog.create({
    data: {
      petId,
      dietPlanId,
      mealNumber,
      scheduledTime,
      plannedGrams,
      actualGrams,
      notes,
      servedByUserId: session.user.id,
      servedAt: servedAt ? new Date(servedAt) : undefined,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/dashboard");
  return { data: mealLog };
}

const UpdateMealLogSchema = z.object({
  mealLogId: z.string().cuid(),
  servedAt: z.string().datetime().optional(),
  actualGrams: z.number().positive().optional(),
  notes: z.string().optional(),
});

const DeleteMealLogSchema = z.object({
  mealLogId: z.string().cuid(),
});

async function getMealLogWithAccess(mealLogId: string, userId: string) {
  const mealLog = await prisma.mealLog.findUnique({
    where: { id: mealLogId },
    include: { pet: true },
  });
  if (!mealLog) return { error: "Registro não encontrado" as const };

  const hasAccess = await userHasPetMutationAccess(mealLog.petId, userId);
  if (!hasAccess) return { error: "Acesso negado" as const };

  const startOfToday = getStartOfToday();
  const startOfTomorrow = getStartOfTomorrow(startOfToday);
  if (mealLog.servedAt < startOfToday || mealLog.servedAt >= startOfTomorrow) {
    return { error: "Só é possível editar refeições de hoje" as const };
  }

  return { mealLog };
}

export async function updateMealLog(formData: z.infer<typeof UpdateMealLogSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = UpdateMealLogSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { mealLogId, servedAt, actualGrams, notes } = parsed.data;

  const access = await getMealLogWithAccess(mealLogId, session.user.id);
  if ("error" in access) return { error: access.error };

  if (servedAt) {
    const servedDate = new Date(servedAt);
    const startOfToday = getStartOfToday();
    const startOfTomorrow = getStartOfTomorrow(startOfToday);
    if (servedDate < startOfToday || servedDate >= startOfTomorrow) {
      return { error: "Horário deve ser de hoje" };
    }
    if (servedDate > new Date()) {
      return { error: "Horário não pode ser no futuro" };
    }
  }

  const updated = await prisma.mealLog.update({
    where: { id: mealLogId },
    data: {
      ...(servedAt !== undefined && { servedAt: new Date(servedAt) }),
      ...(actualGrams !== undefined && { actualGrams }),
      ...(notes !== undefined && { notes }),
    },
  });

  revalidatePath(`/pets/${access.mealLog.petId}`);
  revalidatePath("/dashboard");
  return { data: updated };
}

export async function deleteMealLog(formData: z.infer<typeof DeleteMealLogSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = DeleteMealLogSchema.safeParse(formData);
  if (!parsed.success) return { error: "Dados inválidos" };

  const { mealLogId } = parsed.data;

  const access = await getMealLogWithAccess(mealLogId, session.user.id);
  if ("error" in access) return { error: access.error };

  await prisma.mealLog.delete({ where: { id: mealLogId } });

  revalidatePath(`/pets/${access.mealLog.petId}`);
  revalidatePath("/dashboard");
  return { data: { success: true } };
}

export async function getTodayMealStatus(petId: string): Promise<
  { data: TodayMealStatus } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const startOfToday = getStartOfToday();
  const startOfTomorrow = getStartOfTomorrow(startOfToday);

  const hasAccess = await userHasPetReadAccess(petId, session.user.id);
  if (!hasAccess) return { error: "Pet não encontrado" };

  const pet = await prisma.pet.findFirst({
    where: { id: petId },
    include: {
      dietPlans: {
        where: { isActive: true },
        include: { dietItems: true },
        take: 1,
      },
      mealLogs: {
        where: { servedAt: { gte: startOfToday, lt: startOfTomorrow } },
        orderBy: { servedAt: "desc" },
        include: { servedBy: { select: { name: true } } },
      },
    },
  });

  if (!pet) return { error: "Pet não encontrado" };

  const plan = pet.dietPlans[0];
  if (!plan) return { error: "Nenhum plano alimentar ativo" };

  const totalDailyGrams = plan.dietItems.reduce(
    (sum, item) => sum + Number(item.dailyGrams),
    0
  );
  const plannedGramsPerMeal =
    Math.round((totalDailyGrams / plan.mealsPerDay) * 10) / 10;

  const distributed = distributeMeals(
    Number(plan.nedKcal),
    plan.mealsPerDay,
    plan.wakeTime ?? undefined,
    plan.sleepTime ?? undefined
  );

  const logByMealNumber = new Map(
    pet.mealLogs.map((log) => [log.mealNumber, log])
  );

  const lastServed = pet.mealLogs[0] ?? null;
  const lastServedAt = lastServed?.servedAt.toISOString() ?? null;
  const minutesSinceLastMeal = lastServed
    ? Math.round((Date.now() - lastServed.servedAt.getTime()) / 60000)
    : null;

  const meals = Array.from({ length: plan.mealsPerDay }, (_, i) => {
    const mealNumber = i + 1;
    const log = logByMealNumber.get(mealNumber);
    const scheduledTime =
      distributed[i]?.scheduledTime ?? `${String(7 + i * 3).padStart(2, "0")}:00`;
    const servedAt = log?.servedAt.toISOString() ?? null;

    return {
      mealNumber,
      scheduledTime,
      plannedGrams: plannedGramsPerMeal,
      status: getMealStatus(scheduledTime, servedAt),
      servedAt,
      servedByName: log?.servedBy.name ?? null,
      minutesSinceLastMeal:
        log && lastServed && log.id === lastServed.id ? minutesSinceLastMeal : null,
    };
  });

  const servedCount = meals.filter((m) => m.status === "served").length;
  const totalMeals = plan.mealsPerDay;

  return {
    data: {
      plan: {
        id: plan.id,
        mealsPerDay: plan.mealsPerDay,
        nedKcal: Number(plan.nedKcal),
        wakeTime: plan.wakeTime,
        sleepTime: plan.sleepTime,
      },
      meals,
      summary: {
        totalMeals,
        servedCount,
        pendingCount: totalMeals - servedCount,
        lastServedAt,
        minutesSinceLastMeal,
        completionPercent: totalMeals > 0 ? Math.round((servedCount / totalMeals) * 100) : 0,
      },
    },
  };
}
