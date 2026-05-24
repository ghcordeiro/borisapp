import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { SerializedPet } from "@/lib/db/pets";

type HealthLog = SerializedPet["healthLogs"][number];

interface HealthLogListProps {
  petId: string;
  healthLogs: HealthLog[];
}

const severityColors = {
  LOW: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const severityLabels = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

const typeLabels = {
  SYMPTOM: "Sintoma",
  MEDICATION: "Medicação",
  OBSERVATION: "Observação",
  EMERGENCY: "Emergência",
};

export function HealthLogList({ healthLogs }: HealthLogListProps) {
  if (healthLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Log Clínico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum registro clínico ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Clínico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {healthLogs.map((log) => (
          <div key={log.id} className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {typeLabels[log.type as keyof typeof typeLabels] ?? log.type} • {formatDate(log.occurredAt)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColors[log.severity as keyof typeof severityColors] ?? ""}`}
              >
                {severityLabels[log.severity as keyof typeof severityLabels] ?? log.severity}
              </span>
            </div>
            <p className="text-sm">{log.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
