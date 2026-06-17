import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPetById, serializePet } from "@/lib/db/pets";
import { getWaterSummaryForPet, buildWeightChartData } from "@/lib/db/metrics";
import { userHasPetMutationAccess, userIsPetOwner } from "@/lib/db/access";
import { DailyStatusScreen } from "@/components/tracker/daily-status-screen";
import { WeightCurveCard } from "@/components/tracker/weight-curve-card";
import { LogWeightForm } from "@/components/tracker/log-weight-form";
import { LogWaterForm } from "@/components/tracker/log-water-form";
import { WaterProgress } from "@/components/tracker/water-progress";
import { NutritionSummary } from "@/components/nutrition/nutrition-summary";
import { CreateDietPlanForm } from "@/components/nutrition/create-diet-plan-form";
import { AddDietItemForm } from "@/components/nutrition/add-diet-item-form";
import { HealthLogList } from "@/components/health/health-log-list";
import { AddHealthLogForm } from "@/components/health/add-health-log-form";
import { HealthTimeline } from "@/components/health/health-timeline";
import { VetAppointmentList } from "@/components/health/vet-appointment-list";
import { AddVetAppointmentForm } from "@/components/health/add-vet-appointment-form";
import { DewormingList } from "@/components/health/deworming-list";
import { AddDewormingForm } from "@/components/health/add-deworming-form";
import { VaccineList } from "@/components/health/vaccine-list";
import { AddVaccineForm } from "@/components/health/add-vaccine-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PetPageProps {
  params: Promise<{ petId: string }>;
}

export async function generateMetadata({ params }: PetPageProps): Promise<Metadata> {
  const { petId } = await params;
  const session = await auth();
  const pet = await getPetById(petId, session?.user?.id ?? "");
  return { title: pet?.name ?? "Pet" };
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "Idade desconhecida";
  const birth = new Date(birthDate);
  const now = new Date();
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (months < 1) return "Menos de 1 mês";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${years}a ${rem}m`;
}

const GENDER_LABEL: Record<string, string> = {
  MALE: "Macho",
  FEMALE: "Fêmea",
  UNKNOWN: "—",
};

export default async function PetPage({ params }: PetPageProps) {
  const { petId } = await params;
  const session = await auth();
  const pet = await getPetById(petId, session?.user?.id ?? "");

  if (!pet) notFound();

  const serialized = serializePet(pet);
  const activePlan = serialized.dietPlans[0];
  const lastWeight = serialized.weightLogs.at(-1);
  const canMutate = await userHasPetMutationAccess(petId, session?.user?.id ?? "");
  const isOwner = await userIsPetOwner(petId, session?.user?.id ?? "");
  const waterSummary = await getWaterSummaryForPet(petId, session?.user?.id ?? "");

  const prefs = serialized.preferences;
  const showHealthTab =
    prefs.trackSymptoms ||
    prefs.trackDeworming ||
    prefs.trackVaccines ||
    prefs.trackVetVisits;

  // Ganho de peso desde a primeira pesagem
  const firstWeight = serialized.weightLogs[0];
  const weightGain =
    firstWeight && lastWeight && firstWeight.id !== lastWeight.id
      ? Number((lastWeight.weightKg - firstWeight.weightKg).toFixed(3))
      : null;

  return (
    <div className="space-y-6">

      {/* ── Header do pet ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar / emoji */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-4xl shrink-0">
            🐱
          </div>
          <div>
            <h1 className="text-2xl font-bold">{serialized.name}</h1>
            <p className="text-sm text-muted-foreground">
              {serialized.breed ?? "Sem raça definida"}
              {serialized.gender && serialized.gender !== "UNKNOWN" && (
                <> • {GENDER_LABEL[serialized.gender]}</>
              )}
              {serialized.birthDate && (
                <> • {calcAge(serialized.birthDate)}</>
              )}
            </p>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="flex flex-wrap gap-3 shrink-0">
          <Card className="text-center min-w-[90px]">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Peso atual</p>
              <p className="text-lg font-bold">
                {lastWeight
                  ? `${(lastWeight.weightKg * 1000).toFixed(0)}g`
                  : "—"}
              </p>
              {weightGain !== null && (
                <p className={`text-xs font-medium ${weightGain >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {weightGain >= 0 ? "+" : ""}{(weightGain * 1000).toFixed(0)}g total
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="text-center min-w-[90px]">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Meta kcal</p>
              <p className="text-lg font-bold">
                {activePlan ? `${activePlan.nedKcal.toFixed(0)}` : "—"}
              </p>
              {activePlan && (
                <p className="text-xs text-muted-foreground">kcal/dia</p>
              )}
            </CardContent>
          </Card>

          <Card className="text-center min-w-[90px]">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Registros</p>
              <p className="text-lg font-bold">{serialized.weightLogs.length}</p>
              <p className="text-xs text-muted-foreground">pesagens</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {prefs.trackNutrition && activePlan && <DailyStatusScreen pet={serialized} canMutate={canMutate} />}

      {isOwner && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/pets/${petId}/report`} target="_blank">
              Exportar PDF
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/pets/${petId}/members`}>Família</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/pets/${petId}/settings`}>⚙️ Configurar tracking</Link>
          </Button>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue={prefs.trackNutrition ? "nutrition" : "overview"}>
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start sm:w-auto">
          <TabsTrigger value="overview">📈 Crescimento</TabsTrigger>
          {prefs.trackNutrition && (
            <TabsTrigger value="nutrition">🍽️ Nutrição</TabsTrigger>
          )}
          {showHealthTab && <TabsTrigger value="health">🩺 Saúde</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <LogWeightForm petId={serialized.id} />
          {prefs.trackHydration && waterSummary && (
            <Card>
              <CardContent className="pt-6 pb-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4 text-center">
                  Hidratação hoje
                </p>
                <WaterProgress
                  consumedMl={waterSummary.waterTodayMl}
                  goalMl={waterSummary.waterGoalMl}
                  isKitten={waterSummary.isKitten}
                />
                {canMutate && (
                  <div className="mt-4 flex justify-center">
                    <LogWaterForm
                      petId={serialized.id}
                      waterGoalMl={waterSummary.waterGoalMl}
                      isKitten={waterSummary.isKitten}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {(() => {
            const { chart, summary } = buildWeightChartData(
              serialized.weightLogs.map((w) => ({
                loggedAt: new Date(w.loggedAt),
                weightKg: w.weightKg,
              }))
            );
            return (
              <WeightCurveCard
                chart={chart}
                summary={summary}
                title="Curva de Peso"
                emptyMessage="Nenhuma pesagem registrada ainda."
              />
            );
          })()}

          {serialized.weightLogs.length > 0 && (
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Histórico de pesagens
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {[...serialized.weightLogs].reverse().map((log, i) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between text-sm py-1 border-b border-border/40 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-5 text-right">
                          {i === 0 ? "🔴" : ""}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(log.loggedAt).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {log.notes && (
                          <span className="text-xs text-muted-foreground italic truncate max-w-[140px]">
                            {log.notes}
                          </span>
                        )}
                        <span className="font-semibold tabular-nums">
                          {(log.weightKg * 1000).toFixed(0)}g
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {prefs.trackNutrition && (
          <TabsContent value="nutrition" className="space-y-4 pt-4">
            {!activePlan ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-dashed p-6 text-center space-y-2">
                  <p className="text-2xl">🥣</p>
                  <p className="font-medium">Nenhum plano alimentar configurado</p>
                  <p className="text-sm text-muted-foreground">
                    Crie um plano para calcular automaticamente as necessidades calóricas do {serialized.name}.
                  </p>
                </div>
                <CreateDietPlanForm
                  petId={serialized.id}
                  currentWeightKg={lastWeight?.weightKg}
                />
              </div>
            ) : (
              <>
                <NutritionSummary pet={serialized} />
                <div className="flex flex-wrap gap-2">
                  <AddDietItemForm
                    dietPlanId={activePlan.id}
                    nedKcal={activePlan.nedKcal}
                    mealsPerDay={activePlan.mealsPerDay}
                  />
                  <CreateDietPlanForm
                    petId={serialized.id}
                    currentWeightKg={lastWeight?.weightKg}
                  />
                </div>
              </>
            )}
          </TabsContent>
        )}

        {showHealthTab && (
          <TabsContent value="health" className="space-y-4 pt-4">
            <HealthTimeline pet={serialized} />
            {canMutate && (
              <div className="flex flex-wrap gap-2">
                {prefs.trackSymptoms && <AddHealthLogForm petId={serialized.id} />}
                {prefs.trackVetVisits && <AddVetAppointmentForm petId={serialized.id} />}
                {prefs.trackDeworming && <AddDewormingForm petId={serialized.id} />}
                {prefs.trackVaccines && <AddVaccineForm petId={serialized.id} />}
              </div>
            )}
            {prefs.trackVetVisits && (
              <VetAppointmentList
                appointments={serialized.vetAppointments}
                canMutate={canMutate}
              />
            )}
            {prefs.trackDeworming && (
              <DewormingList dewormings={serialized.dewormings} />
            )}
            {prefs.trackVaccines && <VaccineList vaccines={serialized.vaccines} />}
            {prefs.trackSymptoms && (
              <HealthLogList petId={serialized.id} healthLogs={serialized.healthLogs} />
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
