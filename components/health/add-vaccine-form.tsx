"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addVaccine } from "@/lib/actions/health.actions";

const COMMON_VACCINES = [
  "Quádrupla Felina",
  "Tríplice Felina",
  "Raiva",
  "Leucemia Felina",
  "Outra",
];

interface AddVaccineFormProps {
  petId: string;
}

export function AddVaccineForm({ petId }: AddVaccineFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(COMMON_VACCINES[0] ?? "");
  const [customName, setCustomName] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [vetName, setVetName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const vaccineName = name === "Outra" ? customName : name;
    if (!vaccineName || !appliedAt) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const result = await addVaccine({
        petId,
        name: vaccineName,
        appliedAt: new Date(appliedAt).toISOString(),
        nextDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
        lotNumber: lotNumber || undefined,
        vetName: vetName || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao salvar");
      } else {
        toast.success("Vacina registrada!");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" className="w-full sm:w-auto">
        + Registrar vacina
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar Vacina</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vac-name">Vacina *</Label>
              <select
                id="vac-name"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
              >
                {COMMON_VACCINES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {name === "Outra" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="vac-custom">Nome da vacina *</Label>
                <Input
                  id="vac-custom"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="vac-applied">Aplicada em *</Label>
              <Input
                id="vac-applied"
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-next">Próxima dose</Label>
              <Input
                id="vac-next"
                type="date"
                value={nextDueAt}
                onChange={(e) => setNextDueAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-lot">Lote</Label>
              <Input
                id="vac-lot"
                placeholder="ex: 002/25"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vac-vet">Veterinário</Label>
              <Input id="vac-vet" value={vetName} onChange={(e) => setVetName(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
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
