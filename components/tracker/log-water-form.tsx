"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logWater } from "@/lib/actions/water.actions";

interface LogWaterFormProps {
  petId: string;
  waterGoalMl?: number;
  isKitten?: boolean;
}

export function LogWaterForm({ petId, waterGoalMl = 250, isKitten = false }: LogWaterFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [milliliters, setMilliliters] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ml = parseInt(milliliters, 10);
    if (!ml || ml < 1 || ml > 2000) {
      toast.error("Informe entre 1 e 2000 ml");
      return;
    }

    setLoading(true);
    try {
      const result = await logWater({ petId, milliliters: ml, notes: notes || undefined });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao registrar");
      } else {
        toast.success(`${ml} ml registrados!`);
        setMilliliters("");
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
        + Registrar Água
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar Água</CardTitle>
        <p className="text-sm text-muted-foreground">
          Meta diária: ~{waterGoalMl} ml
          {isKitten && " (estimada para filhote)"}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="water-ml">Quantidade (ml) *</Label>
              <Input
                id="water-ml"
                type="number"
                min={1}
                max={2000}
                placeholder="ex: 50"
                value={milliliters}
                onChange={(e) => setMilliliters(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="water-notes">Observações</Label>
              <Input
                id="water-notes"
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
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
