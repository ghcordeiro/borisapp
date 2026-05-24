import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { SerializedPet } from "@/lib/db/pets";

type Vaccine = SerializedPet["vaccines"][number];

interface VaccineListProps {
  vaccines: Vaccine[];
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function VaccineList({ vaccines }: VaccineListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vacinas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {vaccines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma vacina registrada.
          </p>
        ) : (
          vaccines.map((v) => {
            const days = v.nextDueAt ? daysUntil(v.nextDueAt) : null;
            const showAlert = days !== null && days >= 0 && days <= 30;

            return (
              <div key={v.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{v.name}</p>
                  {showAlert && (
                    <span className="rounded-full bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 px-2 py-0.5 text-xs font-medium shrink-0">
                      Próxima em {days} dias
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Aplicada em {formatDate(v.appliedAt)}
                  {v.lotNumber && ` · Lote ${v.lotNumber}`}
                  {v.vetName && ` · ${v.vetName}`}
                </p>
                {v.nextDueAt && (
                  <p className="text-xs text-muted-foreground">
                    Reforço: {formatDate(v.nextDueAt)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
