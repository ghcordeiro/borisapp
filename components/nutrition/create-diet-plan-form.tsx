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
import { createDietPlan, previewNutritionPlan } from "@/lib/actions/nutrition.actions";
import {
  LIFE_STAGE_LABELS,
  generateMealTimesFromRoutine,
  type LifeStage,
} from "@/lib/nutrition/formulas";

interface CreateDietPlanFormProps {
  petId: string;
  currentWeightKg?: number;
}

export function CreateDietPlanForm({ petId, currentWeightKg }: CreateDietPlanFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [weightKg, setWeightKg] = useState(currentWeightKg?.toString() ?? "");
  const [lifeStage, setLifeStage] = useState<LifeStage | "">("");
  const [mealsPerDay, setMealsPerDay] = useState("4");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [notes, setNotes] = useState("");

  const [preview, setPreview] = useState<{
    rerKcal: number;
    nedKcal: number;
    energyFactor: number;
  } | null>(null);

  // Preview de horários calculados em tempo real
  const mealTimesPreview =
    wakeTime && sleepTime
      ? generateMealTimesFromRoutine(wakeTime, sleepTime, parseInt(mealsPerDay))
      : [];

  async function handlePreview() {
    const kg = parseFloat(weightKg);
    if (!kg || !lifeStage) return;
    const result = await previewNutritionPlan({
      weightKg: kg,
      lifeStage: lifeStage as LifeStage,
      mealsPerDay: parseInt(mealsPerDay),
    });
    if (result?.data) setPreview(result.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseFloat(weightKg);
    if (!kg || !lifeStage) {
      toast.error("Preencha peso e estágio de vida");
      return;
    }

    setLoading(true);
    try {
      const result = await createDietPlan({
        petId,
        weightKg: kg,
        lifeStage: lifeStage as LifeStage,
        mealsPerDay: parseInt(mealsPerDay),
        wakeTime: wakeTime || undefined,
        sleepTime: sleepTime || undefined,
        notes: notes || undefined,
      });

      if (result?.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao criar plano");
      } else {
        toast.success("Plano alimentar criado com sucesso!");
        setOpen(false);
        setPreview(null);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        + Criar Plano Alimentar
      </Button>
    );
  }

  const MEAL_ICONS = ["🌅", "☀️", "🌤️", "🌆", "🌙", "⭐"];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novo Plano Alimentar</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Dados do pet */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Dados do felino
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-weight">Peso atual (kg) *</Label>
                <Input
                  id="plan-weight"
                  type="number"
                  step="0.001"
                  min="0.01"
                  max="20"
                  placeholder="ex: 0.450"
                  value={weightKg}
                  onChange={(e) => { setWeightKg(e.target.value); setPreview(null); }}
                  required
                />
                {weightKg && !isNaN(parseFloat(weightKg)) && (
                  <p className="text-xs text-muted-foreground">
                    = {Math.round(parseFloat(weightKg) * 1000)}g
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Refeições / dia *</Label>
                <Select value={mealsPerDay} onValueChange={(v) => { setMealsPerDay(v); setPreview(null); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}× por dia</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Estágio de vida *</Label>
              <Select value={lifeStage} onValueChange={(v) => { setLifeStage(v as LifeStage); setPreview(null); }}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(LIFE_STAGE_LABELS) as [LifeStage, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rotina do tutor */}
          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <span className="text-base">🕐</span>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Rotina do tutor
              </p>
              <span className="ml-auto text-xs text-muted-foreground">
                Para personalizar os horários das refeições
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="wake-time">Que horas você acorda?</Label>
                <Input
                  id="wake-time"
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sleep-time">Que horas você dorme?</Label>
                <Input
                  id="sleep-time"
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                />
              </div>
            </div>

            {/* Preview dos horários calculados */}
            {mealTimesPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Horários das refeições calculados:
                </p>
                <div className="flex flex-wrap gap-2">
                  {mealTimesPreview.map((time, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-sm"
                    >
                      <span>{MEAL_ICONS[i] ?? "🍽️"}</span>
                      <span className="font-mono font-medium">{time}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Última refeição 1h antes de dormir · distribuídas proporcionalmente
                </p>
              </div>
            )}
          </div>

          {/* Preview calórico */}
          {weightKg && lifeStage && !preview && (
            <Button type="button" variant="outline" size="sm" onClick={handlePreview}>
              Calcular prévia calórica
            </Button>
          )}

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Prévia do Cálculo Calórico
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">RER</p>
                  <p className="font-bold">{preview.rerKcal.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">kcal/dia</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fator</p>
                  <p className="font-bold">×{preview.energyFactor.toFixed(2)}</p>
                </div>
                <div className="text-primary">
                  <p className="text-xs text-muted-foreground">NED (meta)</p>
                  <p className="font-bold">{preview.nedKcal.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">kcal/dia</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="plan-notes">Observações do veterinário</Label>
            <Input
              id="plan-notes"
              placeholder="opcional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !lifeStage}>
              {loading ? "Salvando..." : "Criar Plano"}
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
