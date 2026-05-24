import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { SerializedPet } from "@/lib/db/pets";

type Deworming = SerializedPet["dewormings"][number];

interface DewormingListProps {
  dewormings: Deworming[];
}

function daysUntil(date: string): number {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function DewormingList({ dewormings }: DewormingListProps) {
  const nextDue = dewormings
    .filter((d) => d.nextDueAt && new Date(d.nextDueAt) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.nextDueAt!).getTime() - new Date(b.nextDueAt!).getTime()
    )[0];

  const daysToNext = nextDue?.nextDueAt ? daysUntil(nextDue.nextDueAt) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vermifugação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextDue && daysToNext !== null && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              daysToNext <= 14
                ? "border-red-300 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                : "border-primary/20 bg-primary/5"
            }`}
          >
            Próxima dose de <strong>{nextDue.product}</strong> em{" "}
            <strong>{daysToNext} dias</strong> ({formatDate(nextDue.nextDueAt!)})
          </div>
        )}

        {dewormings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma vermifugação registrada.
          </p>
        ) : (
          dewormings.map((d) => (
            <div key={d.id} className="rounded-lg border p-3">
              <div className="flex justify-between gap-2">
                <p className="font-medium">{d.product}</p>
                <p className="text-sm text-muted-foreground">{formatDate(d.appliedAt)}</p>
              </div>
              {d.nextDueAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Próxima: {formatDate(d.nextDueAt)}
                </p>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
