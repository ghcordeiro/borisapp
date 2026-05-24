import { prisma } from "@/lib/db/client";
import type { MemberRole } from "@prisma/client";

const MUTATION_ROLES: MemberRole[] = ["OWNER", "CAREGIVER"];

/**
 * Verifica se o usuário pode ler dados do pet (dono ou membro).
 */
export async function userHasPetReadAccess(
  petId: string,
  userId: string
): Promise<boolean> {
  const pet = await prisma.pet.findFirst({
    where: {
      id: petId,
      OR: [{ userId }, { members: { some: { userId } } }],
    },
    select: { id: true },
  });
  return !!pet;
}

/**
 * Verifica se o usuário pode mutar dados do pet (dono ou CAREGIVER/OWNER membro).
 */
export async function userHasPetMutationAccess(
  petId: string,
  userId: string
): Promise<boolean> {
  const pet = await prisma.pet.findFirst({
    where: {
      id: petId,
      OR: [
        { userId },
        {
          members: {
            some: { userId, role: { in: MUTATION_ROLES } },
          },
        },
      ],
    },
    select: { id: true },
  });
  return !!pet;
}

/**
 * Verifica se o usuário é o dono original do pet (pode convidar/remover membros).
 */
export async function userIsPetOwner(
  petId: string,
  userId: string
): Promise<boolean> {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, userId },
    select: { id: true },
  });
  return !!pet;
}

/**
 * Where clause para listar pets acessíveis ao usuário.
 */
export function petsAccessibleWhere(userId: string) {
  return {
    isActive: true,
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}

/**
 * Where clause para buscar um pet por id com acesso do usuário.
 */
export function petAccessibleWhere(petId: string, userId: string) {
  return {
    id: petId,
    OR: [{ userId }, { members: { some: { userId } } }],
  };
}
