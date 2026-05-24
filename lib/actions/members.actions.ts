"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userHasPetReadAccess, userIsPetOwner } from "@/lib/db/access";

const PetIdSchema = z.object({
  petId: z.string().cuid(),
  role: z.enum(["CAREGIVER", "VIEWER"]).default("CAREGIVER"),
});

const JoinInviteSchema = z.object({
  token: z.string().min(1),
});

const RemoveMemberSchema = z.object({
  petId: z.string().cuid(),
  memberId: z.string().cuid(),
});

function getInviteBaseUrl(): string {
  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3000";
}

export async function createInvite(formData: z.infer<typeof PetIdSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = PetIdSchema.safeParse(formData);
  if (!parsed.success) return { error: "Pet inválido" };

  const { petId, role } = parsed.data;

  const isOwner = await userIsPetOwner(petId, session.user.id);
  if (!isOwner) return { error: "Apenas o dono pode convidar membros" };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.petInvite.create({
    data: {
      petId,
      createdBy: session.user.id,
      role,
      expiresAt,
    },
  });

  const url = `${getInviteBaseUrl()}/invite/${invite.token}`;
  return { data: { url, token: invite.token, expiresAt: invite.expiresAt.toISOString() } };
}

export async function joinByInvite(formData: z.infer<typeof JoinInviteSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = JoinInviteSchema.safeParse(formData);
  if (!parsed.success) return { error: "Convite inválido" };

  const { token } = parsed.data;

  const invite = await prisma.petInvite.findUnique({
    where: { token },
    include: { pet: true },
  });

  if (!invite) return { error: "Convite não encontrado" };
  if (invite.usedAt) return { error: "Convite já utilizado" };
  if (invite.expiresAt < new Date()) return { error: "Convite expirado" };

  if (invite.pet.userId === session.user.id) {
    return { error: "Você já é o dono deste pet" };
  }

  const existingMember = await prisma.petMember.findUnique({
    where: {
      petId_userId: { petId: invite.petId, userId: session.user.id },
    },
  });

  if (existingMember) {
    return { error: "Você já é membro deste pet" };
  }

  await prisma.$transaction([
    prisma.petMember.create({
      data: {
        petId: invite.petId,
        userId: session.user.id,
        role: invite.role,
        joinedAt: new Date(),
      },
    }),
    prisma.petInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ]);

  revalidatePath(`/pets/${invite.petId}`);
  revalidatePath("/dashboard");
  return { data: { petId: invite.petId, petName: invite.pet.name } };
}

export async function removeMember(formData: z.infer<typeof RemoveMemberSchema>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const parsed = RemoveMemberSchema.safeParse(formData);
  if (!parsed.success) return { error: "Dados inválidos" };

  const { petId, memberId } = parsed.data;

  const isOwner = await userIsPetOwner(petId, session.user.id);
  if (!isOwner) return { error: "Apenas o dono pode remover membros" };

  const member = await prisma.petMember.findFirst({
    where: { id: memberId, petId },
  });
  if (!member) return { error: "Membro não encontrado" };

  await prisma.petMember.delete({ where: { id: memberId } });

  revalidatePath(`/pets/${petId}/members`);
  return { data: { success: true } };
}

export async function listMembers(petId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Não autenticado" };

  const hasAccess = await userHasPetReadAccess(petId, session.user.id);
  if (!hasAccess) return { error: "Acesso negado" };

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: {
      user: { select: { id: true, name: true, email: true, image: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!pet) return { error: "Pet não encontrado" };

  const ownerEntry = {
    id: `owner-${pet.user.id}`,
    userId: pet.user.id,
    role: "OWNER" as const,
    user: pet.user,
    joinedAt: null as string | null,
  };

  const members = pet.members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    user: m.user,
    joinedAt: m.joinedAt?.toISOString() ?? null,
  }));

  return { data: [ownerEntry, ...members] };
}

export async function getInvitePreview(token: string) {
  const invite = await prisma.petInvite.findUnique({
    where: { token },
    include: {
      pet: { select: { id: true, name: true, breed: true } },
    },
  });

  if (!invite) return { error: "Convite não encontrado" };
  if (invite.usedAt) return { error: "Convite já utilizado" };
  if (invite.expiresAt < new Date()) return { error: "Convite expirado" };

  return {
    data: {
      petName: invite.pet.name,
      petBreed: invite.pet.breed,
      expiresAt: invite.expiresAt.toISOString(),
    },
  };
}
