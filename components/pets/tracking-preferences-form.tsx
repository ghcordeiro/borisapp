"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updatePetPreferences } from "@/lib/actions/preferences.actions";
import type { ResolvedPreferences, PrefKey } from "@/lib/db/preferences";

interface TrackingPreferencesFormProps {
  petId: string;
  initial: ResolvedPreferences;
}

const TOGGLE_META: Array<{
  key: PrefKey;
  emoji: string;
  label: string;
  desc: string;
}> = [
  {
    key: "trackNutrition",
    emoji: "🍽️",
    label: "Nutrição",
    desc: "Plano alimentar, refeições e Score do Dia",
  },
  {
    key: "trackHydration",
    emoji: "🚰",
    label: "Hidratação",
    desc: "Meta diária e log de água",
  },
  {
    key: "trackSymptoms",
    emoji: "📝",
    label: "Sintomas / observações",
    desc: "Registros clínicos do dia a dia",
  },
  {
    key: "trackDeworming",
    emoji: "💊",
    label: "Vermifugação",
    desc: "Aplicações e próximas doses",
  },
  {
    key: "trackVaccines",
    emoji: "💉",
    label: "Vacinas",
    desc: "Calendário vacinal",
  },
  {
    key: "trackVetVisits",
    emoji: "🏥",
    label: "Consultas vet",
    desc: "Agenda de consultas",
  },
];

export function TrackingPreferencesForm({
  petId,
  initial,
}: TrackingPreferencesFormProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ResolvedPreferences>(initial);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: PrefKey, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updatePetPreferences({ petId, ...prefs });
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Configurações salvas");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-1 pt-6">
        <div className="flex items-center justify-between py-3 opacity-60">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚖️</span>
            <div>
              <p className="text-sm font-medium">Peso & crescimento</p>
              <p className="text-xs text-muted-foreground">
                Sempre ativo (base dos cálculos de água e dieta)
              </p>
            </div>
          </div>
          <Switch checked disabled />
        </div>
        {TOGGLE_META.map(({ key, emoji, label, desc }) => (
          <div
            key={key}
            className="flex items-center justify-between border-t py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{emoji}</span>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Switch
              checked={prefs[key]}
              onCheckedChange={(v) => handleToggle(key, v)}
              disabled={isPending}
            />
          </div>
        ))}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
