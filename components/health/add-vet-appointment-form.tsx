"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createVetAppointment } from "@/lib/actions/health.actions";

interface AddVetAppointmentFormProps {
  petId: string;
}

export function AddVetAppointmentForm({ petId }: AddVetAppointmentFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [vetName, setVetName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) {
      toast.error("Informe data e hora");
      return;
    }

    setLoading(true);
    try {
      const result = await createVetAppointment({
        petId,
        title,
        vetName: vetName || undefined,
        clinicName: clinicName || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao agendar");
      } else {
        toast.success("Consulta agendada!");
        setTitle("");
        setVetName("");
        setClinicName("");
        setScheduledAt("");
        setNotes("");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" className="w-full sm:w-auto">
        + Agendar consulta
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agendar Consulta Veterinária</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="apt-title">Título *</Label>
              <Input
                id="apt-title"
                placeholder="Consulta de rotina, vacinação..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-vet">Veterinário</Label>
              <Input id="apt-vet" value={vetName} onChange={(e) => setVetName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apt-clinic">Clínica</Label>
              <Input id="apt-clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="apt-datetime">Data e hora *</Label>
              <Input
                id="apt-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="apt-notes">Observações</Label>
              <Input id="apt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Agendar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
