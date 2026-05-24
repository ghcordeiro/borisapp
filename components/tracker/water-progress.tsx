"use client";

import { CircularProgress } from "@/components/tracker/circular-progress";

interface WaterProgressProps {
  consumedMl: number;
  goalMl: number;
  isKitten?: boolean;
}

const KITTEN_DISPLAY_FLOOR_ML = 50;

export function WaterProgress({ consumedMl, goalMl, isKitten = false }: WaterProgressProps) {
  const displayGoalMl =
    isKitten && goalMl < KITTEN_DISPLAY_FLOOR_ML ? KITTEN_DISPLAY_FLOOR_ML : goalMl;
  const percent =
    displayGoalMl > 0 ? Math.min(100, Math.round((consumedMl / displayGoalMl) * 100)) : 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <CircularProgress
        percent={percent}
        primaryLabel={`${percent}%`}
        secondaryLabel="água hoje"
      />
      <p className="text-sm text-muted-foreground">
        {consumedMl} / {goalMl} ml
      </p>
      {isKitten && (
        <p className="text-xs text-muted-foreground text-center max-w-[220px]">
          Filhote pequeno — meta estimada ({goalMl} ml). Registre o que observar na tigela.
        </p>
      )}
    </div>
  );
}
