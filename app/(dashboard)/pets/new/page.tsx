import { Metadata } from "next";
import { PetForm } from "@/components/pets/pet-form";

export const metadata: Metadata = {
  title: "Novo Pet",
};

export default function NewPetPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cadastrar Novo Pet</h1>
        <p className="text-sm text-muted-foreground">
          Preencha as informações do seu felino para começar o acompanhamento.
        </p>
      </div>
      <PetForm />
    </div>
  );
}
