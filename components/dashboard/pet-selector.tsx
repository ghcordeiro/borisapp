"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";

interface PetOption {
  id: string;
  name: string;
}

interface PetSelectorProps {
  pets: PetOption[];
  selectedPetId: string;
}

export function PetSelector({ pets, selectedPetId }: PetSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pets.length <= 1) return null;

  function handleChange(petId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("petId", petId);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="pet-selector" className="text-sm text-muted-foreground shrink-0">
        Métricas de:
      </Label>
      <select
        id="pet-selector"
        className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
        value={selectedPetId}
        onChange={(e) => handleChange(e.target.value)}
      >
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name}
          </option>
        ))}
      </select>
    </div>
  );
}
