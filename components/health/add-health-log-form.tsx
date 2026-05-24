"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addHealthLog } from "@/lib/actions/health.actions";

type HealthLogType = "SYMPTOM" | "MEDICATION" | "OBSERVATION" | "EMERGENCY";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const TYPE_LABELS: Record<HealthLogType, string> = {
  SYMPTOM: "Sintoma",
  MEDICATION: "Medicação",
  OBSERVATION: "Observação",
  EMERGENCY: "Emergência",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  LOW: "text-green-700",
  MEDIUM: "text-yellow-700",
  HIGH: "text-orange-700",
  CRITICAL: "text-red-700",
};

interface AddHealthLogFormProps {
  petId: string;
}

export function AddHealthLogForm({ petId }: AddHealthLogFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<HealthLogType | "">("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("LOW");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !description.trim()) {
      toast.error("Preencha o tipo e a descrição");
      return;
    }

    setLoading(true);
    try {
      const result = await addHealthLog({
        petId,
        type: type as HealthLogType,
        description: description.trim(),
        severity,
        notes: notes.trim() || undefined,
      });

      if (result?.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao salvar registro");
      } else {
        toast.success("Registro clínico salvo!");
        setType("");
        setDescription("");
        setSeverity("LOW");
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
        + Adicionar Registro
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo Registro Clínico</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as HealthLogType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [HealthLogType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Gravidade</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SEVERITY_LABELS) as [Severity, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      <span className={SEVERITY_COLORS[v]}>{l}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="health-description">Descrição *</Label>
            <Input
              id="health-description"
              placeholder="ex: Barriga estufada após refeição"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="health-notes">Observações adicionais</Label>
            <Input
              id="health-notes"
              placeholder="ex: Aconteceu após trocar a ração"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !type}>
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
