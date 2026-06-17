import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userIsPetOwner } from "@/lib/db/access";
import { getPetPreferences } from "@/lib/db/preferences";
import { TrackingPreferencesForm } from "@/components/pets/tracking-preferences-form";

interface SettingsPageProps {
  params: Promise<{ petId: string }>;
}

export const metadata: Metadata = {
  title: "Configurar tracking",
};

export default async function PetSettingsPage({ params }: SettingsPageProps) {
  const { petId } = await params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) redirect("/login");

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    select: { id: true, name: true },
  });
  if (!pet) notFound();

  const isOwner = await userIsPetOwner(petId, userId);
  if (!isOwner) {
    redirect(`/pets/${petId}?error=owner-only`);
  }

  const preferences = await getPetPreferences(petId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/pets/${petId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para {pet.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Configurar tracking</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o que você quer acompanhar do {pet.name}. Dados antigos
          ficam preservados — só somem da UI.
        </p>
      </div>
      <TrackingPreferencesForm petId={petId} initial={preferences} />
    </div>
  );
}
