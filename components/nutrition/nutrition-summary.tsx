"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SerializedPet } from "@/lib/db/pets";
import { distributeMeals } from "@/lib/nutrition/formulas";

interface NutritionSummaryProps {
  pet: SerializedPet;
}

type PlanItem = SerializedPet["dietPlans"][number]["dietItems"][number];

const MEAL_ICONS = ["🌅", "☀️", "🌤️", "🌆", "🌙", "⭐"];

export function NutritionSummary({ pet }: NutritionSummaryProps) {
  const plan = pet.dietPlans[0];

  if (!plan) {
    return null; // sem plano, a página pai já mostra o CreateDietPlanForm
  }

  const meals = distributeMeals(plan.nedKcal, plan.mealsPerDay, plan.wakeTime ?? undefined, plan.sleepTime ?? undefined);
  const times = meals.map((m) => m.scheduledTime);
  const kcalPerMeal = plan.nedKcal / plan.mealsPerDay;
  const hasRoutine = !!(plan.wakeTime && plan.sleepTime);

  // Para cada item, calcular gramas por refeição
  const itemsWithMeals = plan.dietItems.map((item: PlanItem) => ({
    ...item,
    gramsPerMeal: Math.round((item.dailyGrams / plan.mealsPerDay) * 10) / 10,
    kcalDaily: Math.round((item.kcalPer100g * item.dailyGrams) / 100 * 10) / 10,
    percentOfNed: Math.round((item.kcalPer100g * item.dailyGrams) / plan.nedKcal * 10) / 10,
  }));

  const totalDailyGrams = itemsWithMeals.reduce((s: number, i: typeof itemsWithMeals[number]) => s + i.dailyGrams, 0);

  return (
    <div className="space-y-5">

      {/* ── Cabeçalho calórico ── */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">RER</p>
            <p className="text-2xl font-bold tabular-nums">{plan.rerKcal.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">kcal/dia em repouso</p>
          </CardContent>
        </Card>

        <Card className="text-center border-primary/30 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">NED (meta)</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{plan.nedKcal.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">kcal/dia necessárias</p>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Por refeição</p>
            <p className="text-2xl font-bold tabular-nums">{kcalPerMeal.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">kcal × {plan.mealsPerDay} refeições</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Rotina do tutor ── */}
      {hasRoutine ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="text-lg">🕐</span>
          <div className="flex gap-4">
            <span>
              <span className="text-muted-foreground">Acorda</span>{" "}
              <span className="font-semibold">{plan.wakeTime}</span>
            </span>
            <span className="text-muted-foreground">·</span>
            <span>
              <span className="text-muted-foreground">Dorme</span>{" "}
              <span className="font-semibold">{plan.sleepTime}</span>
            </span>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Horários adaptados à rotina do tutor
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-sm text-muted-foreground">
          <span>🕐</span>
          <span>Crie um novo plano informando a rotina do tutor para horários personalizados.</span>
        </div>
      )}

      {/* ── Grade de refeições ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Distribuição das {plan.mealsPerDay} Refeições
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(plan.mealsPerDay, 4)}, 1fr)` }}>
            {Array.from({ length: plan.mealsPerDay }, (_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-muted/30 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{MEAL_ICONS[i] ?? "🍽️"}</span>
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    {times[i] ?? `${7 + i * 3}:00`}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Refeição {i + 1}</p>
                  <p className="text-base font-bold">{kcalPerMeal.toFixed(1)} kcal</p>
                </div>

                {/* Itens por refeição */}
                {itemsWithMeals.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    {itemsWithMeals.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-1">
                        <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                        <span className="text-xs font-semibold whitespace-nowrap">{item.gramsPerMeal}g</span>
                      </div>
                    ))}
                  </div>
                )}

                {itemsWithMeals.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 italic">sem alimentos</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Itens da dieta detalhados ── */}
      {itemsWithMeals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Alimentos Cadastrados</CardTitle>
              <span className="text-xs text-muted-foreground">
                Total: {totalDailyGrams.toFixed(1)}g/dia
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {itemsWithMeals.map((item) => {
              const pct = Math.min(100, Math.round((item.dailyGrams / Math.max(totalDailyGrams, 1)) * 100));
              return (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.kcalPer100g} kcal/100g
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold">{item.dailyGrams.toFixed(1)}g/dia</p>
                      <p className="text-xs text-muted-foreground">{item.gramsPerMeal}g × {plan.mealsPerDay} refeições</p>
                    </div>
                  </div>
                  {/* Barra de progresso proporcional */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    {item.kcalDaily.toFixed(1)} kcal/dia ({pct}% do volume)
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Fator energético ── */}
      <div className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm text-muted-foreground">
        <span className="text-base">⚡</span>
        <span>Fator energético</span>
        <span className="ml-auto font-semibold text-foreground">×{plan.energyFactor.toFixed(2)}</span>
        <span className="text-xs">(NED = RER × fator)</span>
      </div>

    </div>
  );
}
