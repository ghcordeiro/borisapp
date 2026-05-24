import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPetsByUser, serializePetSummary } from "@/lib/db/pets";
import { getMetricsForPet } from "@/lib/db/metrics";
import { PetCard } from "@/components/pets/pet-card";
import { WelcomeFlow } from "@/components/onboarding/welcome-flow";
import { MetricsDashboard } from "@/components/dashboard/metrics-dashboard";
import { PetSelector } from "@/components/dashboard/pet-selector";
import { LogWeightForm } from "@/components/tracker/log-weight-form";
import { LogWaterForm } from "@/components/tracker/log-water-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface DashboardPageProps {
  searchParams: Promise<{ petId?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  const petsRaw = await getPetsByUser(session?.user?.id ?? "");
  const pets = petsRaw.map(serializePetSummary);
  const { petId: requestedPetId } = await searchParams;

  const selectedPet =
    pets.find((p) => p.id === requestedPetId) ?? pets[0] ?? null;

  const metrics = selectedPet
    ? await getMetricsForPet(selectedPet.id, session?.user?.id ?? "")
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meus Felinos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a saúde e nutrição dos seus pets
          </p>
        </div>
        <Button asChild>
          <Link href="/pets/new">+ Novo Pet</Link>
        </Button>
      </div>

      {pets.length === 0 ? (
        <WelcomeFlow />
      ) : (
        <>
          {metrics && (
            <section className="space-y-4">
              <Suspense fallback={null}>
                <PetSelector
                  pets={pets.map((p) => ({ id: p.id, name: p.name }))}
                  selectedPetId={metrics.petId}
                />
              </Suspense>
              <MetricsDashboard metrics={metrics} />
              <div className="flex flex-wrap gap-2">
                <LogWeightForm petId={metrics.petId} />
                <LogWaterForm
                  petId={metrics.petId}
                  waterGoalMl={metrics.waterGoalMl}
                  isKitten={metrics.isKitten}
                />
                <Button asChild variant="outline">
                  <Link href={`/pets/${metrics.petId}`}>Ver pet completo →</Link>
                </Button>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Todos os pets</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
