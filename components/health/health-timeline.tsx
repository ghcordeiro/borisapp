import { formatDate } from "@/lib/utils";
import type { SerializedPet } from "@/lib/db/pets";

interface HealthTimelineProps {
  pet: SerializedPet;
}

type TimelineEvent = {
  id: string;
  date: string;
  type: string;
  title: string;
  subtitle?: string;
  icon: string;
};

export function HealthTimeline({ pet }: HealthTimelineProps) {
  const prefs = pet.preferences;
  const events: TimelineEvent[] = [
    ...(prefs.trackSymptoms ? pet.healthLogs : []).map((log) => ({
      id: `health-${log.id}`,
      date: log.occurredAt,
      type: "Log clínico",
      title: log.description,
      subtitle: `${log.type} · ${log.severity}`,
      icon: "🩺",
    })),
    ...(prefs.trackVetVisits ? pet.vetAppointments : []).map((apt) => ({
      id: `vet-${apt.id}`,
      date: apt.scheduledAt,
      type: "Consulta",
      title: apt.title,
      subtitle: apt.status,
      icon: "🏥",
    })),
    ...(prefs.trackDeworming ? pet.dewormings : []).map((d) => ({
      id: `dew-${d.id}`,
      date: d.appliedAt,
      type: "Vermifugação",
      title: d.product,
      subtitle: d.nextDueAt ? `Próxima: ${formatDate(d.nextDueAt)}` : undefined,
      icon: "💊",
    })),
    ...(prefs.trackVaccines ? pet.vaccines : []).map((v) => ({
      id: `vac-${v.id}`,
      date: v.appliedAt,
      type: "Vacina",
      title: v.name,
      subtitle: v.nextDueAt ? `Reforço: ${formatDate(v.nextDueAt)}` : undefined,
      icon: "💉",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum evento de saúde registrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm">
              {event.icon}
            </div>
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-border min-h-[24px]" />
            )}
          </div>
          <div className="pb-6 flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatDate(event.date)}</span>
              <span>·</span>
              <span>{event.type}</span>
            </div>
            <p className="font-medium mt-0.5">{event.title}</p>
            {event.subtitle && (
              <p className="text-sm text-muted-foreground">{event.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
