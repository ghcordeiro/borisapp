"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { removeMember } from "@/lib/actions/members.actions";

interface MemberUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface MemberEntry {
  id: string;
  userId: string;
  role: "OWNER" | "CAREGIVER" | "VIEWER";
  user: MemberUser;
  joinedAt: string | null;
}

interface MemberListProps {
  petId: string;
  members: MemberEntry[];
  isOwner: boolean;
}

const ROLE_LABELS: Record<MemberEntry["role"], string> = {
  OWNER: "Dono",
  CAREGIVER: "Cuidador",
  VIEWER: "Visualizador",
};

export function MemberList({ petId, members, isOwner }: MemberListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRemove(memberId: string) {
    setLoadingId(memberId);
    try {
      const result = await removeMember({ petId, memberId });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao remover");
      } else {
        toast.success("Membro removido");
      }
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Membros da família</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">
                {member.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.user.image}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  "👤"
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {member.user.name ?? member.user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {member.user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {ROLE_LABELS[member.role]}
              </span>
              {isOwner && member.role !== "OWNER" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={loadingId === member.id}
                  onClick={() => handleRemove(member.id)}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
