"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logWeight } from "@/lib/actions/pets.actions";

interface LogWeightFormProps {
  petId: string;
}

export function LogWeightForm({ petId }: LogWeightFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseFloat(weightKg);
    if (!kg || kg <= 0) {
      toast.error("Informe um peso válido");
      return;
    }

    setLoading(true);
    try {
      const result = await logWeight({ petId, weightKg: kg, notes: notes || undefined });
      if (result?.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao salvar pesagem");
      } else {
        toast.success(`Peso de ${kg} kg registrado!`);
        setWeightKg("");
        setNotes("");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        + Registrar Peso
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar Pesagem</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="weight">Peso (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.001"
                min="0.01"
                max="20"
                placeholder="ex: 0.450"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
              {weightKg && (
                <p className="text-xs text-muted-foreground">
                  = {Math.round(parseFloat(weightKg) * 1000)}g
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-notes">Observações</Label>
              <Input
                id="weight-notes"
                placeholder="opcional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
