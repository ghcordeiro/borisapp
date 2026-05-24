"use client";

import Link from "next/link";
import { Cat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatWeight } from "@/lib/utils";
import type { SerializedPetSummary } from "@/lib/db/pets";

interface PetCardProps {
  pet: SerializedPetSummary;
}

export function PetCard({ pet }: PetCardProps) {
  const lastWeight = pet.weightLogs[0];
  const activePlan = pet.dietPlans[0];

  return (
    <Link href={`/pets/${pet.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
            <Cat className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 overflow-hidden">
            <CardTitle className="truncate text-base">{pet.name}</CardTitle>
            <p className="truncate text-xs text-muted-foreground">
              {pet.breed ?? "Sem raça definida"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Peso atual</span>
            <span className="font-medium">
              {lastWeight
                ? formatWeight(lastWeight.weightKg)
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Plano alimentar</span>
            <span className="font-medium">
              {activePlan
                ? `${activePlan.nedKcal.toFixed(0)} kcal/dia`
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
