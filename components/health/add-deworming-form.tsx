"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDeworming } from "@/lib/actions/health.actions";

interface AddDewormingFormProps {
  petId: string;
}

export function AddDewormingForm({ petId }: AddDewormingFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!appliedAt) {
      toast.error("Informe a data de aplicação");
      return;
    }

    setLoading(true);
    try {
      const result = await addDeworming({
        petId,
        product,
        appliedAt: new Date(appliedAt).toISOString(),
        nextDueAt: nextDueAt ? new Date(nextDueAt).toISOString() : undefined,
        notes: notes || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao salvar");
      } else {
        toast.success("Vermifugação registrada!");
        setProduct("");
        setAppliedAt("");
        setNextDueAt("");
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
        + Registrar vermifugação
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registrar Vermifugação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="dew-product">Produto *</Label>
              <Input
                id="dew-product"
                placeholder="Drontal Gatos..."
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dew-applied">Aplicado em *</Label>
              <Input
                id="dew-applied"
                type="date"
                value={appliedAt}
                onChange={(e) => setAppliedAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dew-next">Próxima dose</Label>
              <Input
                id="dew-next"
                type="date"
                value={nextDueAt}
                onChange={(e) => setNextDueAt(e.target.value)}
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
