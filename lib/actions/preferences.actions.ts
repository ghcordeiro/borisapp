"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { userIsPetOwner } from "@/lib/db/access";

const updateSchema = z.object({
  petId: z.string().min(1),
  trackNutrition: z.boolean(),
  trackHydration: z.boolean(),
  trackSymptoms: z.boolean(),
  trackDeworming: z.boolean(),
  trackVaccines: z.boolean(),
  trackVetVisits: z.boolean(),
});

export async function updatePetPreferences(input: z.infer<typeof updateSchema>) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Não autenticado" } as const;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos" } as const;

  const isOwner = await userIsPetOwner(parsed.data.petId, userId);
  if (!isOwner) {
    return { error: "Apenas o dono do pet pode mudar as configurações" } as const;
  }

  const { petId, ...prefs } = parsed.data;
  await prisma.petPreferences.upsert({
    where: { petId },
    create: { petId, ...prefs },
    update: prefs,
  });

  revalidatePath(`/pets/${petId}`);
  revalidatePath(`/pets/${petId}/settings`);
  revalidatePath(`/dashboard`);

  return { success: true } as const;
}
