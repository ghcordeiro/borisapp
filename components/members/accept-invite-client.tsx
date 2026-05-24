"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { joinByInvite } from "@/lib/actions/members.actions";

interface AcceptInviteClientProps {
  token: string;
  petName: string;
  petBreed: string | null;
}

export function AcceptInviteClient({
  token,
  petName,
  petBreed,
}: AcceptInviteClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    try {
      const result = await joinByInvite({ token });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao aceitar");
        return;
      }
      toast.success(`Você agora acompanha ${petName}!`);
      router.push(`/pets/${result.data?.petId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-md w-full">
      <CardHeader className="text-center">
        <div className="text-4xl mb-2">🐱</div>
        <CardTitle>Convite para acompanhar {petName}</CardTitle>
        {petBreed && (
          <p className="text-sm text-muted-foreground">{petBreed}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Ao aceitar, você poderá registrar refeições e acompanhar o pet como cuidador.
        </p>
        <Button className="w-full" onClick={handleAccept} disabled={loading}>
          {loading ? "Aceitando..." : "Aceitar convite"}
        </Button>
      </CardContent>
    </Card>
  );
}
