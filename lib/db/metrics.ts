import { prisma } from "@/lib/db/client";
import { userHasPetReadAccess } from "@/lib/db/access";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface PetMetrics {
  petId: string;
  petName: string;
  weightChart: Array<{ date: string; peso: number }>;
  mealsChart: Array<{ date: string; refeicoes: number }>;
  waterChart: Array<{ date: string; ml: number; meta: number }>;
  dailyScore: number;
  waterGoalMl: number;
  waterTodayMl: number;
  lastWeightKg: number | null;
  isKitten: boolean;
}

export interface WaterSummary {
  waterGoalMl: number;
  waterTodayMl: number;
  isKitten: boolean;
}

function computeWaterGoalMl(lastWeightKg: number | null): number {
  return lastWeightKg ? Math.round(lastWeightKg * 50) : 250;
}

function computeIsKitten(lastWeightKg: number | null, birthDate: Date | null): boolean {
  if (lastWeightKg !== null && lastWeightKg < 1) return true;
  if (birthDate) {
    const months =
      (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 6) return true;
  }
  return false;
}

function getTodayBounds() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  return { startOfToday, startOfTomorrow };
}

export async function getWaterSummaryForPet(
  petId: string,
  userId: string
): Promise<WaterSummary | null> {
  const hasAccess = await userHasPetReadAccess(petId, userId);
  if (!hasAccess) return null;

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { id: true, birthDate: true },
  });

  if (!pet) return null;

  const lastWeight = await prisma.weightLog.findFirst({
    where: { petId },
    orderBy: { loggedAt: "desc" },
  });
  const lastWeightKg = lastWeight ? Number(lastWeight.weightKg) : null;
  const waterGoalMl = computeWaterGoalMl(lastWeightKg);
  const isKitten = computeIsKitten(lastWeightKg, pet.birthDate);

  const { startOfToday, startOfTomorrow } = getTodayBounds();
  const waterTodayMl = await prisma.waterLog.aggregate({
    where: {
      petId,
      loggedAt: { gte: startOfToday, lt: startOfTomorrow },
    },
    _sum: { milliliters: true },
  });

  return {
    waterGoalMl,
    waterTodayMl: waterTodayMl._sum.milliliters ?? 0,
    isKitten,
  };
}

function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function labelDay(date: Date): string {
  return format(date, "EEE dd/MM", { locale: ptBR });
}

export async function getMetricsForPet(
  petId: string,
  userId: string
): Promise<PetMetrics | null> {
  const hasAccess = await userHasPetReadAccess(petId, userId);
  if (!hasAccess) return null;

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    include: {
      weightLogs: { orderBy: { loggedAt: "asc" } },
      dietPlans: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  if (!pet) return null;

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [mealLogs, waterLogs] = await Promise.all([
    prisma.mealLog.findMany({
      where: { petId, servedAt: { gte: sevenDaysAgo } },
    }),
    prisma.waterLog.findMany({
      where: { petId, loggedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const lastWeight = pet.weightLogs.at(-1);
  const lastWeightKg = lastWeight ? Number(lastWeight.weightKg) : null;
  const waterGoalMl = computeWaterGoalMl(lastWeightKg);
  const isKitten = computeIsKitten(lastWeightKg, pet.birthDate);

  const weightChart = pet.weightLogs
    .filter((w) => w.loggedAt >= fourWeeksAgo)
    .map((w) => ({
      date: format(w.loggedAt, "dd/MM"),
      peso: Math.round(Number(w.weightKg) * 1000),
    }));

  const mealsByDay = new Map<string, number>();
  const waterByDay = new Map<string, number>();

  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    mealsByDay.set(key, 0);
    waterByDay.set(key, 0);
  }

  for (const log of mealLogs) {
    const key = dayKey(log.servedAt);
    if (mealsByDay.has(key)) {
      mealsByDay.set(key, (mealsByDay.get(key) ?? 0) + 1);
    }
  }

  for (const log of waterLogs) {
    const key = dayKey(log.loggedAt);
    if (waterByDay.has(key)) {
      waterByDay.set(key, (waterByDay.get(key) ?? 0) + log.milliliters);
    }
  }

  const mealsChart = Array.from(mealsByDay.entries()).map(([key, count]) => ({
    date: labelDay(new Date(key)),
    refeicoes: count,
  }));

  const waterChart = Array.from(waterByDay.entries()).map(([key, ml]) => ({
    date: labelDay(new Date(key)),
    ml,
    meta: waterGoalMl,
  }));

  const { startOfToday, startOfTomorrow } = getTodayBounds();

  const todayMeals = mealLogs.filter(
    (m) => m.servedAt >= startOfToday && m.servedAt < startOfTomorrow
  ).length;

  const activePlan = pet.dietPlans[0];
  const mealsPerDay = activePlan?.mealsPerDay ?? 4;
  const dailyScore =
    mealsPerDay > 0 ? Math.round((todayMeals / mealsPerDay) * 100) : 0;

  const waterTodayMl = waterLogs
    .filter((w) => w.loggedAt >= startOfToday && w.loggedAt < startOfTomorrow)
    .reduce((sum, w) => sum + w.milliliters, 0);

  return {
    petId: pet.id,
    petName: pet.name,
    weightChart,
    mealsChart,
    waterChart,
    dailyScore,
    waterGoalMl,
    waterTodayMl,
    lastWeightKg,
    isKitten,
  };
}
