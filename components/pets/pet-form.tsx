"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { createPet } from "@/lib/actions/pets.actions";

export function PetForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      await createPet({
        name: data.get("name") as string,
        breed: (data.get("breed") as string) || undefined,
        gender: (data.get("gender") as "MALE" | "FEMALE" | "UNKNOWN") || undefined,
        notes: (data.get("notes") as string) || undefined,
      });
      toast.success("Pet cadastrado com sucesso!");
    } catch {
      toast.error("Erro ao cadastrar pet. Tente novamente.");
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ex: Boris, Mia, Simba..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="breed">Raça</Label>
            <Input
              id="breed"
              name="breed"
              placeholder="Ex: Persa, Siamês, SRD..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gênero</Label>
            <Select name="gender" defaultValue="UNKNOWN">
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Macho</SelectItem>
                <SelectItem value="FEMALE">Fêmea</SelectItem>
                <SelectItem value="UNKNOWN">Não informado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Input
              id="notes"
              name="notes"
              placeholder="Informações adicionais..."
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Cadastrar Pet"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
