"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logMeal, updateMealLog, deleteMealLog } from "@/lib/actions/meals.actions";
import { distributeMeals } from "@/lib/nutrition/formulas";
import type { SerializedPet } from "@/lib/db/pets";
import { cn } from "@/lib/utils";

interface DailyStatusScreenProps {
  pet: SerializedPet;
  canMutate?: boolean;
}

type MealStatus = "upcoming" | "due" | "served" | "missed";

const MEAL_ICONS = ["🌅", "☀️", "🌤️", "🌆", "🌙", "⭐"];

function getMealStatus(scheduledTime: string, servedAt: string | null): MealStatus {
  if (servedAt) return "served";

  const now = new Date();
  const [h = 0, m = 0] = scheduledTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);

  const diffMin = (now.getTime() - scheduled.getTime()) / 60000;
  if (diffMin < 0) return "upcoming";
  if (diffMin <= 60) return "due";
  return "missed";
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h e ${m}min`;
}

function formatServedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nowTimeString(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function isoToTimeString(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildServedAtIso(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function DailyStatusScreen({ pet, canMutate = true }: DailyStatusScreenProps) {
  const router = useRouter();
  const plan = pet.dietPlans[0];
  const [loadingMeal, setLoadingMeal] = useState<number | null>(null);
  const [servingMeal, setServingMeal] = useState<number | null>(null);
  const [editingMeal, setEditingMeal] = useState<number | null>(null);
  const [servedTime, setServedTime] = useState(nowTimeString());
  const [actualGrams, setActualGrams] = useState("");
  const [notes, setNotes] = useState("");
  const [showExtras, setShowExtras] = useState(false);

  if (!plan) return null;

  const activePlan = plan;

  const distributed = distributeMeals(
    activePlan.nedKcal,
    activePlan.mealsPerDay,
    activePlan.wakeTime ?? undefined,
    activePlan.sleepTime ?? undefined
  );

  const totalDailyGrams = activePlan.dietItems.reduce((s, i) => s + i.dailyGrams, 0);
  const gramsPerMeal = Math.round((totalDailyGrams / activePlan.mealsPerDay) * 10) / 10;

  const logByMealNumber = new Map(
    pet.mealLogs.map((log) => [log.mealNumber, log])
  );

  const meals = Array.from({ length: activePlan.mealsPerDay }, (_, i) => {
    const mealNumber = i + 1;
    const log = logByMealNumber.get(mealNumber);
    const scheduledTime =
      distributed[i]?.scheduledTime ?? `${String(7 + i * 3).padStart(2, "0")}:00`;
    const servedAt = log?.servedAt ?? null;

    return {
      mealNumber,
      mealLogId: log?.id ?? null,
      scheduledTime,
      status: getMealStatus(scheduledTime, servedAt),
      servedAt,
      servedByName: log?.servedBy?.name ?? null,
      actualGrams: log?.actualGrams ?? null,
      notes: log?.notes ?? null,
    };
  });

  const servedCount = meals.filter((m) => m.status === "served").length;
  const completionPercent =
    activePlan.mealsPerDay > 0
      ? Math.round((servedCount / activePlan.mealsPerDay) * 100)
      : 0;

  const lastServed = pet.mealLogs[0];
  const minutesSinceLastMeal = lastServed
    ? Math.round((Date.now() - new Date(lastServed.servedAt).getTime()) / 60000)
    : null;

  function resetFormFields() {
    setActualGrams("");
    setNotes("");
    setShowExtras(false);
  }

  function openServeForm(mealNumber: number, scheduledTime: string, status: MealStatus) {
    setServingMeal(mealNumber);
    setEditingMeal(null);
    setServedTime(status === "missed" ? scheduledTime : nowTimeString());
    resetFormFields();
  }

  function openEditForm(mealNumber: number, servedAt: string, logActualGrams: number | null, logNotes: string | null) {
    setEditingMeal(mealNumber);
    setServingMeal(null);
    setServedTime(isoToTimeString(servedAt));
    setActualGrams(logActualGrams != null ? String(logActualGrams) : "");
    setNotes(logNotes ?? "");
    setShowExtras(Boolean(logActualGrams || logNotes));
  }

  function cancelForms() {
    setServingMeal(null);
    setEditingMeal(null);
    resetFormFields();
  }

  async function handleServe(mealNumber: number, scheduledTime: string) {
    setLoadingMeal(mealNumber);
    try {
      const parsedGrams = actualGrams ? parseFloat(actualGrams) : undefined;
      const result = await logMeal({
        petId: pet.id,
        dietPlanId: activePlan.id,
        mealNumber,
        scheduledTime,
        plannedGrams: gramsPerMeal > 0 ? gramsPerMeal : 1,
        servedAt: buildServedAtIso(servedTime),
        actualGrams: parsedGrams && parsedGrams > 0 ? parsedGrams : undefined,
        notes: notes || undefined,
      });

      if ("error" in result && result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : "Erro ao registrar refeição";
        toast.error(msg);
      } else {
        toast.success("Refeição registrada!");
        cancelForms();
        router.refresh();
      }
    } finally {
      setLoadingMeal(null);
    }
  }

  async function handleUpdate(mealLogId: string, mealNumber: number) {
    setLoadingMeal(mealNumber);
    try {
      const parsedGrams = actualGrams ? parseFloat(actualGrams) : undefined;
      const result = await updateMealLog({
        mealLogId,
        servedAt: buildServedAtIso(servedTime),
        actualGrams: parsedGrams && parsedGrams > 0 ? parsedGrams : undefined,
        notes: notes || undefined,
      });

      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao atualizar");
      } else {
        toast.success("Refeição atualizada!");
        cancelForms();
        router.refresh();
      }
    } finally {
      setLoadingMeal(null);
    }
  }

  async function handleDelete(mealLogId: string, mealNumber: number) {
    if (!window.confirm("Desfazer este registro de refeição?")) return;

    setLoadingMeal(mealNumber);
    try {
      const result = await deleteMealLog({ mealLogId });
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Erro ao desfazer");
      } else {
        toast.success("Registro removido");
        cancelForms();
        router.refresh();
      }
    } finally {
      setLoadingMeal(null);
    }
  }

  function renderMealForm(
    mealNumber: number,
    scheduledTime: string,
    mode: "serve" | "edit",
    mealLogId?: string | null
  ) {
    return (
      <div className="space-y-3 rounded-lg border bg-background/80 p-3">
        <div className="space-y-1.5">
          <Label htmlFor={`served-time-${mealNumber}`}>
            Horário em que serviu
          </Label>
          <Input
            id={`served-time-${mealNumber}`}
            type="time"
            value={servedTime}
            onChange={(e) => setServedTime(e.target.value)}
            disabled={loadingMeal === mealNumber}
          />
          {mode === "serve" && (
            <p className="text-xs text-muted-foreground">
              Planejado às {scheduledTime} — ajuste se serviu em outro horário
            </p>
          )}
        </div>

        {!showExtras ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setShowExtras(true)}
          >
            + Gramas reais e observação
          </Button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`actual-grams-${mealNumber}`}>Gramas reais</Label>
              <Input
                id={`actual-grams-${mealNumber}`}
                type="number"
                min={0}
                step={0.1}
                placeholder={`~${gramsPerMeal}g`}
                value={actualGrams}
                onChange={(e) => setActualGrams(e.target.value)}
                disabled={loadingMeal === mealNumber}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`meal-notes-${mealNumber}`}>Observação</Label>
              <Input
                id={`meal-notes-${mealNumber}`}
                placeholder="opcional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loadingMeal === mealNumber}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            className="flex-1 min-w-[120px]"
            disabled={loadingMeal === mealNumber}
            onClick={() =>
              mode === "serve"
                ? handleServe(mealNumber, scheduledTime)
                : mealLogId && handleUpdate(mealLogId, mealNumber)
            }
          >
            {loadingMeal === mealNumber
              ? "Salvando..."
              : mode === "serve"
                ? "Confirmar"
                : "Salvar alterações"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={loadingMeal === mealNumber}
            onClick={cancelForms}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig: Record<
    MealStatus,
    { label: string; border: string; badge: string }
  > = {
    served: {
      label: "SERVIDA",
      border: "border-green-500/50 bg-green-50/50 dark:bg-green-950/20",
      badge: "text-green-700 dark:text-green-400",
    },
    due: {
      label: "AGORA",
      border: "border-primary ring-2 ring-primary/30 animate-pulse",
      badge: "text-primary font-semibold",
    },
    missed: {
      label: "ATRASADA",
      border: "border-orange-500/50 bg-orange-50/30 dark:bg-orange-950/20",
      badge: "text-orange-600 dark:text-orange-400",
    },
    upcoming: {
      label: "EM BREVE",
      border: "border-dashed border-muted-foreground/30",
      badge: "text-muted-foreground",
    },
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Status de hoje</CardTitle>
          <span className="text-sm text-muted-foreground">{pet.name}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {activePlan.nedKcal.toFixed(0)} kcal/dia · {activePlan.mealsPerDay} refeições
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {servedCount} de {activePlan.mealsPerDay} refeições completas
            </span>
            <span className="font-bold text-primary">{completionPercent}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {meals.map((meal, i) => {
            const cfg = statusConfig[meal.status];
            const itemsLabel = activePlan.dietItems
              .map(
                (item) =>
                  `${item.name}: ${Math.round((item.dailyGrams / activePlan.mealsPerDay) * 10) / 10}g`
              )
              .join(" · ");

            return (
              <div
                key={meal.mealNumber}
                className={cn("rounded-xl border p-4 space-y-2", cfg.border)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{MEAL_ICONS[i] ?? "🍽️"}</span>
                    <span className="font-mono font-semibold">{meal.scheduledTime}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      Refeição {meal.mealNumber}
                    </span>
                  </div>
                  <span className={cn("text-xs font-medium shrink-0", cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                {itemsLabel && (
                  <p className="text-xs text-muted-foreground truncate">{itemsLabel}</p>
                )}

                {meal.status === "served" && meal.servedAt && (
                  <div className="space-y-1">
                    <p className="text-sm text-green-700 dark:text-green-400">
                      Servido às {formatServedTime(meal.servedAt)}
                      {meal.servedByName && <> por <strong>{meal.servedByName}</strong></>}
                      {meal.actualGrams != null && <> · {meal.actualGrams}g</>}
                    </p>
                    {meal.notes && (
                      <p className="text-xs text-muted-foreground italic">{meal.notes}</p>
                    )}
                  </div>
                )}

                {meal.status === "served" && canMutate && meal.mealLogId && (
                  editingMeal === meal.mealNumber ? (
                    renderMealForm(meal.mealNumber, meal.scheduledTime, "edit", meal.mealLogId)
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingMeal === meal.mealNumber}
                        onClick={() =>
                          openEditForm(
                            meal.mealNumber,
                            meal.servedAt!,
                            meal.actualGrams,
                            meal.notes
                          )
                        }
                      >
                        Corrigir horário
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={loadingMeal === meal.mealNumber}
                        onClick={() => handleDelete(meal.mealLogId!, meal.mealNumber)}
                      >
                        Desfazer
                      </Button>
                    </div>
                  )
                )}

                {(meal.status === "due" || meal.status === "missed") && canMutate && (
                  servingMeal === meal.mealNumber ? (
                    renderMealForm(meal.mealNumber, meal.scheduledTime, "serve")
                  ) : (
                    <Button
                      size={meal.status === "due" ? "lg" : "sm"}
                      className={cn(
                        "w-full min-h-[44px]",
                        meal.status === "due" && "h-12 text-base font-semibold"
                      )}
                      onClick={() => openServeForm(meal.mealNumber, meal.scheduledTime, meal.status)}
                    >
                      {meal.status === "due" ? "Dei agora" : "Registrar mesmo assim"}
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          {minutesSinceLastMeal !== null ? (
            <span>
              Última refeição: há{" "}
              <strong>{formatMinutes(minutesSinceLastMeal)}</strong>
            </span>
          ) : (
            <span className="text-muted-foreground">
              Nenhuma refeição registrada hoje ainda
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
