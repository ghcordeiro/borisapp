"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createInvite } from "@/lib/actions/members.actions";

interface InviteButtonProps {
  petId: string;
}

export function InviteButton({ petId }: InviteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"CAREGIVER" | "VIEWER">("CAREGIVER");

  async function handleInvite() {
    setLoading(true);
    try {
      const result = await createInvite({ petId, role });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao gerar convite");
        return;
      }
      if (result.data?.url) {
        await navigator.clipboard.writeText(result.data.url);
        toast.success("Link copiado! Válido por 7 dias.");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline">
        🔗 Convidar familiar
      </Button>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-4 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="invite-role">Tipo de acesso</Label>
        <select
          id="invite-role"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as "CAREGIVER" | "VIEWER")}
          disabled={loading}
        >
          <option value="CAREGIVER">Cuidador — pode registrar refeições, peso e saúde</option>
          <option value="VIEWER">Visualizador — somente leitura</option>
        </select>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleInvite} disabled={loading}>
          {loading ? "Gerando..." : "Copiar link de convite"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
