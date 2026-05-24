"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  completeVetAppointment,
  cancelVetAppointment,
} from "@/lib/actions/health.actions";
import type { SerializedPet } from "@/lib/db/pets";

type VetAppointment = SerializedPet["vetAppointments"][number];

interface VetAppointmentListProps {
  appointments: VetAppointment[];
  canMutate?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reagendada",
};

export function VetAppointmentList({
  appointments,
  canMutate = true,
}: VetAppointmentListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const now = new Date();

  const upcoming = appointments.filter(
    (a) => a.status === "SCHEDULED" && new Date(a.scheduledAt) >= now
  );
  const past = appointments.filter(
    (a) => !(a.status === "SCHEDULED" && new Date(a.scheduledAt) >= now)
  );

  async function handleComplete(id: string) {
    setLoadingId(id);
    try {
      const result = await completeVetAppointment(id);
      if ("error" in result && result.error) toast.error(result.error as string);
      else toast.success("Consulta marcada como concluída");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCancel(id: string) {
    setLoadingId(id);
    try {
      const result = await cancelVetAppointment(id);
      if ("error" in result && result.error) toast.error(result.error as string);
      else toast.success("Consulta cancelada");
    } finally {
      setLoadingId(null);
    }
  }

  function renderItem(apt: VetAppointment) {
    return (
      <div key={apt.id} className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium">{apt.title}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(apt.scheduledAt)} às{" "}
              {new Date(apt.scheduledAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {(apt.vetName || apt.clinicName) && (
              <p className="text-xs text-muted-foreground">
                {[apt.vetName, apt.clinicName].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <span className="text-xs rounded-full bg-muted px-2 py-0.5 shrink-0">
            {STATUS_LABELS[apt.status] ?? apt.status}
          </span>
        </div>
        {canMutate && apt.status === "SCHEDULED" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loadingId === apt.id}
              onClick={() => handleComplete(apt.id)}
            >
              Concluir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={loadingId === apt.id}
              onClick={() => handleCancel(apt.id)}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consultas Veterinárias</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma consulta registrada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Consultas Veterinárias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Próximas</p>
            {upcoming.map(renderItem)}
          </div>
        )}
        {past.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Histórico</p>
            {past.map(renderItem)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
