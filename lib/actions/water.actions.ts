"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userHasPetMutationAccess } from "@/lib/db/access";

const LogWaterSchema = z.object({
  petId: z.string().cuid(),
  milliliters: z.number().int().min(1).max(2000),
  loggedAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export async function logWater(formData: z.infer<typeof LogWaterSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = LogWaterSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { petId, milliliters, loggedAt, notes } = parsed.data;

  const hasAccess = await userHasPetMutationAccess(petId, session.user.id);
  if (!hasAccess) return { error: "Pet não encontrado" };

  const waterLog = await prisma.waterLog.create({
    data: {
      petId,
      milliliters,
      loggedAt: loggedAt ? new Date(loggedAt) : undefined,
      notes,
    },
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/dashboard");
  return { data: waterLog };
}

export async function getTodayWaterTotal(petId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const logs = await prisma.waterLog.findMany({
    where: {
      petId,
      loggedAt: { gte: startOfToday, lt: startOfTomorrow },
    },
  });

  const total = logs.reduce((sum, l) => sum + l.milliliters, 0);
  return { data: total };
}
