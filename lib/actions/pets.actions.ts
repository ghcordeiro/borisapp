"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userHasPetMutationAccess } from "@/lib/db/access";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(50),
  breed: z.string().max(100).optional(),
  birthDate: z.string().datetime().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  imageUrl: z.string().url().optional().nullable(),
  notes: z.string().max(500).optional(),
});

const WeightLogSchema = z.object({
  petId: z.string().cuid(),
  weightKg: z.number().positive("Peso deve ser positivo"),
  loggedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function createPet(formData: z.infer<typeof PetSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = PetSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const pet = await prisma.pet.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
      birthDate: parsed.data.birthDate
        ? new Date(parsed.data.birthDate)
        : undefined,
    },
  });

  redirect(`/pets/${pet.id}`);
}

export async function updatePet(
  petId: string,
  formData: z.infer<typeof PetSchema>
) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = PetSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const existing = await prisma.pet.findUnique({
    where: { id: petId, userId: session.user.id },
  });
  if (!existing) return { error: "Pet não encontrado" };

  const pet = await prisma.pet.update({
    where: { id: petId },
    data: {
      ...parsed.data,
      birthDate: parsed.data.birthDate
        ? new Date(parsed.data.birthDate)
        : null,
    },
  });

  revalidatePath(`/pets/${petId}`);
  return {
    data: {
      id: pet.id,
      name: pet.name,
    },
  };
}

export async function logWeight(formData: z.infer<typeof WeightLogSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = WeightLogSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const hasAccess = await userHasPetMutationAccess(parsed.data.petId, session.user.id);
  if (!hasAccess) return { error: "Pet não encontrado" };

  const weightLog = await prisma.weightLog.create({
    data: {
      petId: parsed.data.petId,
      weightKg: parsed.data.weightKg,
      loggedAt: parsed.data.loggedAt ? new Date(parsed.data.loggedAt) : undefined,
      notes: parsed.data.notes,
    },
  });

  revalidatePath(`/pets/${parsed.data.petId}`);
  return {
    data: {
      id: weightLog.id,
      petId: weightLog.petId,
      weightKg: Number(weightLog.weightKg),
      loggedAt: weightLog.loggedAt.toISOString(),
    },
  };
}

export async function deletePet(petId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const pet = await prisma.pet.findUnique({
    where: { id: petId, userId: session.user.id },
  });
  if (!pet) return { error: "Pet não encontrado" };

  await prisma.pet.delete({ where: { id: petId } });

  redirect("/dashboard");
}
