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
import { addDietItem } from "@/lib/actions/nutrition.actions";

type DietItemType = "KIBBLE" | "WET_FOOD" | "SUPPLEMENT" | "TREAT" | "OTHER";

const TYPE_LABELS: Record<DietItemType, string> = {
  KIBBLE: "Ração Seca",
  WET_FOOD: "Sachê / Úmido",
  SUPPLEMENT: "Suplemento",
  TREAT: "Petisco",
  OTHER: "Outro",
};

interface AddDietItemFormProps {
  dietPlanId: string;
  nedKcal: number;
  mealsPerDay: number;
}

export function AddDietItemForm({ dietPlanId, nedKcal, mealsPerDay }: AddDietItemFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<DietItemType | "">("");
  const [kcalPer100g, setKcalPer100g] = useState("");
  const [percentage, setPercentage] = useState("100");

  const kcal = parseFloat(kcalPer100g);
  const pct = parseFloat(percentage);
  const dailyKcal = nedKcal * pct / 100;
  const dailyGrams = kcal > 0 ? Math.round(dailyKcal / kcal * 100 * 10) / 10 : 0;
  const gramsPerMeal = mealsPerDay > 0 ? Math.round(dailyGrams / mealsPerDay * 10) / 10 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !type || !kcal || !pct) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const result = await addDietItem({
        dietPlanId,
        name,
        type: type as DietItemType,
        kcalPer100g: kcal,
        percentageOfDiet: pct,
      });

      if (result?.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao adicionar item");
      } else {
        toast.success(`${name} adicionado à dieta!`);
        setName("");
        setType("");
        setKcalPer100g("");
        setPercentage("100");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
        + Adicionar Alimento
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adicionar Item à Dieta</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="item-name">Nome do alimento *</Label>
              <Input
                id="item-name"
                placeholder="ex: Royal Canin Kitten"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as DietItemType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [DietItemType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="kcal-per-100g">Kcal / 100g *</Label>
              <Input
                id="kcal-per-100g"
                type="number"
                step="1"
                min="1"
                max="900"
                placeholder="ex: 370"
                value={kcalPer100g}
                onChange={(e) => setKcalPer100g(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="percentage">% do NED coberto por este item *</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="percentage"
                  type="number"
                  step="5"
                  min="5"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {pct > 0 && (
                  <span className="text-sm text-muted-foreground">
                    = {dailyKcal.toFixed(1)} kcal/dia
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Resumo calculado */}
          {kcal > 0 && pct > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Quantidade calculada</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-lg font-bold">{dailyGrams}g</p>
                  <p className="text-xs text-muted-foreground">por dia</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{gramsPerMeal}g</p>
                  <p className="text-xs text-muted-foreground">por refeição ({mealsPerDay}×/dia)</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !type}>
              {loading ? "Salvando..." : "Adicionar"}
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
