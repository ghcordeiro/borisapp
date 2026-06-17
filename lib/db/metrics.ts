import { prisma } from "@/lib/db/client";
import { userHasPetReadAccess } from "@/lib/db/access";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getPetPreferences, type ResolvedPreferences } from "@/lib/db/preferences";

export interface WeightChartPoint {
  date: string;
  peso: number;
  pesoKg: number;
  isInterpolated: boolean;
  deltaG: number | null;
  weekGrowthG: number | null;
}

export interface WeightSummary {
  avgG: number;
  minG: number;
  maxG: number;
  totalDeltaG: number;
  weeklyGrowthG: number;
  trendStartG: number | null;
  trendEndG: number | null;
}

export interface PetMetrics {
  petId: string;
  petName: string;
  weightChart: WeightChartPoint[];
  weightSummary: WeightSummary | null;
  mealsChart: Array<{ date: string; refeicoes: number }>;
  waterChart: Array<{ date: string; ml: number; meta: number }>;
  dailyScore: number;
  waterGoalMl: number;
  waterTodayMl: number;
  lastWeightKg: number | null;
  isKitten: boolean;
  preferences: ResolvedPreferences;
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type RealDailyLog = { date: Date; weightKg: number };

function groupByDay(
  logs: Array<{ loggedAt: Date; weightKg: number }>
): RealDailyLog[] {
  const buckets = new Map<string, number[]>();
  for (const log of logs) {
    const key = log.loggedAt.toISOString().slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(Number(log.weightKg));
  }
  return Array.from(buckets.entries())
    .map(([key, weights]) => ({
      date: new Date(`${key}T00:00:00.000Z`),
      weightKg: weights.reduce((s, w) => s + w, 0) / weights.length,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function interpolateDaily(real: RealDailyLog[]): Array<RealDailyLog & { isInterpolated: boolean }> {
  if (real.length === 0) return [];
  if (real.length === 1) {
    return [{ ...real[0]!, isInterpolated: false }];
  }
  const firstDay = real[0]!.date;
  const lastDay = real[real.length - 1]!.date;
  const totalDays = Math.round(
    (lastDay.getTime() - firstDay.getTime()) / MS_PER_DAY
  );
  const out: Array<RealDailyLog & { isInterpolated: boolean }> = [];
  for (let offset = 0; offset <= totalDays; offset++) {
    const day = new Date(firstDay);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    const realMatch = real.find((r) => r.date.toISOString().slice(0, 10) === key);
    if (realMatch) {
      out.push({ ...realMatch, isInterpolated: false });
      continue;
    }
    const prev = [...real].reverse().find((r) => r.date < day);
    const next = real.find((r) => r.date > day);
    if (!prev || !next) continue;
    const t =
      (day.getTime() - prev.date.getTime()) /
      (next.date.getTime() - prev.date.getTime());
    const weightKg = prev.weightKg + (next.weightKg - prev.weightKg) * t;
    out.push({ date: day, weightKg, isInterpolated: true });
  }
  return out;
}

function linearRegression(
  points: Array<{ x: number; y: number }>
): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function buildWeightChartData(
  logs: Array<{ loggedAt: Date; weightKg: number }>
): { chart: WeightChartPoint[]; summary: WeightSummary | null } {
  if (logs.length === 0) {
    return { chart: [], summary: null };
  }

  const realDaily = groupByDay(logs);
  const daily = interpolateDaily(realDaily);

  const chart: WeightChartPoint[] = daily.map((d, index) => {
    const peso = Math.round(d.weightKg * 1000);
    const prev = index > 0 ? daily[index - 1] : null;
    const prevPeso = prev ? Math.round(prev.weightKg * 1000) : null;
    const deltaG = prevPeso !== null ? peso - prevPeso : null;

    // With 1 point per day (interpolated when missing), 7 days ago is at index - 7.
    const weekRefIndex = index - 7;
    const weekRef = weekRefIndex >= 0 ? daily[weekRefIndex] : null;
    const weekGrowthG = weekRef
      ? peso - Math.round(weekRef.weightKg * 1000)
      : null;

    return {
      date: format(d.date, "dd/MM"),
      peso,
      pesoKg: Number(d.weightKg.toFixed(3)),
      isInterpolated: d.isInterpolated,
      deltaG,
      weekGrowthG,
    };
  });

  const realPesos = realDaily.map((r) => Math.round(r.weightKg * 1000));
  const first = realDaily[0]!;
  const last = realDaily[realDaily.length - 1]!;
  const spanDays = Math.max(
    (last.date.getTime() - first.date.getTime()) / MS_PER_DAY,
    1
  );

  const trend = linearRegression(
    realDaily.map((r) => ({
      x: (r.date.getTime() - first.date.getTime()) / MS_PER_DAY,
      y: Math.round(r.weightKg * 1000),
    }))
  );

  const summary: WeightSummary = {
    avgG: Math.round(realPesos.reduce((s, p) => s + p, 0) / realPesos.length),
    minG: Math.min(...realPesos),
    maxG: Math.max(...realPesos),
    totalDeltaG:
      Math.round(last.weightKg * 1000) - Math.round(first.weightKg * 1000),
    weeklyGrowthG: Math.round(
      ((Math.round(last.weightKg * 1000) -
        Math.round(first.weightKg * 1000)) /
        spanDays) *
        7
    ),
    trendStartG: trend ? Math.round(trend.intercept) : null,
    trendEndG: trend
      ? Math.round(trend.intercept + trend.slope * spanDays)
      : null,
  };

  return { chart, summary };
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

  const recentWeightLogs = pet.weightLogs.filter((w) => w.loggedAt >= fourWeeksAgo);
  const { chart: weightChart, summary: weightSummary } = buildWeightChartData(
    recentWeightLogs.map((w) => ({
      loggedAt: w.loggedAt,
      weightKg: Number(w.weightKg),
    }))
  );

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

  const preferences = await getPetPreferences(petId);

  return {
    petId: pet.id,
    petName: pet.name,
    weightChart,
    weightSummary,
    mealsChart,
    waterChart,
    dailyScore,
    waterGoalMl,
    waterTodayMl,
    lastWeightKg,
    isKitten,
    preferences,
  };
}
