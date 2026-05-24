import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { listMembers } from "@/lib/actions/members.actions";
import { userIsPetOwner, userHasPetReadAccess } from "@/lib/db/access";
import { getPetById } from "@/lib/db/pets";
import { InviteButton } from "@/components/members/invite-button";
import { MemberList } from "@/components/members/member-list";
import { Button } from "@/components/ui/button";

interface MembersPageProps {
  params: Promise<{ petId: string }>;
}

export async function generateMetadata({ params }: MembersPageProps): Promise<Metadata> {
  const { petId } = await params;
  const session = await auth();
  const pet = await getPetById(petId, session?.user?.id ?? "");
  return { title: pet ? `Membros — ${pet.name}` : "Membros" };
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { petId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const hasAccess = await userHasPetReadAccess(petId, session.user.id);
  if (!hasAccess) notFound();

  const pet = await getPetById(petId, session.user.id);
  if (!pet) notFound();

  const isOwner = await userIsPetOwner(petId, session.user.id);
  const membersResult = await listMembers(petId);

  if ("error" in membersResult && membersResult.error) {
    notFound();
  }

  const members = membersResult.data ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Família — {pet.name}</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie quem pode acompanhar e registrar refeições
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/pets/${petId}`}>← Voltar</Link>
        </Button>
      </div>

      {isOwner && <InviteButton petId={petId} />}

      <MemberList petId={petId} members={members} isOwner={isOwner} />
    </div>
  );
}
