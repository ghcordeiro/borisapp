import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInvitePreview } from "@/lib/actions/members.actions";
import { AcceptInviteClient } from "@/components/members/accept-invite-client";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Aceitar convite",
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  const preview = await getInvitePreview(token);

  if ("error" in preview && preview.error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="text-center space-y-2">
          <p className="text-4xl">😿</p>
          <h1 className="text-xl font-bold">Convite inválido</h1>
          <p className="text-muted-foreground">{preview.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <AcceptInviteClient
        token={token}
        petName={preview.data?.petName ?? "Pet"}
        petBreed={preview.data?.petBreed ?? null}
      />
    </div>
  );
}
