import Link from "next/link";
import { Cat } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyPets() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
        <Cat className="h-8 w-8 text-violet-500" />
      </div>
      <h2 className="mb-1 text-lg font-semibold">Nenhum pet cadastrado</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Comece cadastrando o seu felino para acompanhar saúde e nutrição.
      </p>
      <Button asChild>
        <Link href="/pets/new">Cadastrar meu primeiro pet</Link>
      </Button>
    </div>
  );
}
