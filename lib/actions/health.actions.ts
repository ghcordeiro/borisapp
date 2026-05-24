"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userHasPetMutationAccess } from "@/lib/db/access";

const AddHealthLogSchema = z.object({
  petId: z.string().cuid(),
  type: z.enum(["SYMPTOM", "MEDICATION", "OBSERVATION", "EMERGENCY"]),
  description: z.string().min(1, "Descrição é obrigatória").max(500),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("LOW"),
  occurredAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

const VetAppointmentSchema = z.object({
  petId: z.string().cuid(),
  title: z.string().min(1).max(100),
  vetName: z.string().max(100).optional(),
  clinicName: z.string().max(100).optional(),
  scheduledAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

const DewormingSchema = z.object({
  petId: z.string().cuid(),
  product: z.string().min(1).max(100),
  doseMg: z.number().positive().optional(),
  appliedAt: z.string().datetime(),
  nextDueAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

const VaccineSchema = z.object({
  petId: z.string().cuid(),
  name: z.string().min(1).max(100),
  appliedAt: z.string().datetime(),
  nextDueAt: z.string().datetime().optional(),
  lotNumber: z.string().max(50).optional(),
  vetName: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

async function assertMutationAccess(petId: string, userId: string) {
  const hasAccess = await userHasPetMutationAccess(petId, userId);
  if (!hasAccess) return { error: "Pet não encontrado" as const };
  return null;
}

export async function addHealthLog(formData: z.infer<typeof AddHealthLogSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = AddHealthLogSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { petId, type, description, severity, occurredAt, notes } = parsed.data;

  const denied = await assertMutationAccess(petId, session.user.id);
  if (denied) return denied;

  const healthLog = await prisma.healthLog.create({
    data: {
      petId,
      type,
      description,
      severity,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
      notes,
    },
  });

  revalidatePath(`/pets/${petId}`);
  return { data: healthLog };
}

export async function createVetAppointment(
  formData: z.infer<typeof VetAppointmentSchema>
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = VetAppointmentSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { petId, title, vetName, clinicName, scheduledAt, notes } = parsed.data;

  const denied = await assertMutationAccess(petId, session.user.id);
  if (denied) return denied;

  const appointment = await prisma.vetAppointment.create({
    data: {
      petId,
      title,
      vetName,
      clinicName,
      scheduledAt: new Date(scheduledAt),
      notes,
    },
  });

  revalidatePath(`/pets/${petId}`);
  return { data: appointment };
}

export async function completeVetAppointment(appointmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const appointment = await prisma.vetAppointment.findUnique({
    where: { id: appointmentId },
    include: { pet: true },
  });
  if (!appointment) return { error: "Consulta não encontrada" };

  const denied = await assertMutationAccess(appointment.petId, session.user.id);
  if (denied) return denied;

  const updated = await prisma.vetAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  revalidatePath(`/pets/${appointment.petId}`);
  return { data: updated };
}

export async function cancelVetAppointment(appointmentId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const appointment = await prisma.vetAppointment.findUnique({
    where: { id: appointmentId },
    include: { pet: true },
  });
  if (!appointment) return { error: "Consulta não encontrada" };

  const denied = await assertMutationAccess(appointment.petId, session.user.id);
  if (denied) return denied;

  const updated = await prisma.vetAppointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED" },
  });

  revalidatePath(`/pets/${appointment.petId}`);
  return { data: updated };
}

export async function addDeworming(formData: z.infer<typeof DewormingSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = DewormingSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { petId, product, doseMg, appliedAt, nextDueAt, notes } = parsed.data;

  const denied = await assertMutationAccess(petId, session.user.id);
  if (denied) return denied;

  const deworming = await prisma.deworming.create({
    data: {
      petId,
      product,
      doseMg,
      appliedAt: new Date(appliedAt),
      nextDueAt: nextDueAt ? new Date(nextDueAt) : undefined,
      notes,
    },
  });

  revalidatePath(`/pets/${petId}`);
  return { data: deworming };
}

export async function addVaccine(formData: z.infer<typeof VaccineSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = VaccineSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { petId, name, appliedAt, nextDueAt, lotNumber, vetName, notes } =
    parsed.data;

  const denied = await assertMutationAccess(petId, session.user.id);
  if (denied) return denied;

  const vaccine = await prisma.vaccine.create({
    data: {
      petId,
      name,
      appliedAt: new Date(appliedAt),
      nextDueAt: nextDueAt ? new Date(nextDueAt) : undefined,
      lotNumber,
      vetName,
      notes,
    },
  });

  revalidatePath(`/pets/${petId}`);
  return { data: vaccine };
}
