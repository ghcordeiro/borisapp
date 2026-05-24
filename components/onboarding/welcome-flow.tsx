"use client";

import Link from "next/link";
import { Cat, Scale, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STEPS = [
  {
    step: 1,
    title: "Cadastre seu felino",
    description: "Nome, nascimento, raça e peso inicial.",
    href: "/pets/new",
    icon: Cat,
    cta: "Criar pet",
  },
  {
    step: 2,
    title: "Registre o peso",
    description: "Após criar o pet, registre a primeira pesagem na aba Crescimento.",
    href: "/pets/new",
    icon: Scale,
    cta: "Ir para cadastro",
  },
  {
    step: 3,
    title: "Configure a nutrição",
    description: "Crie o plano alimentar com RER/NED e horários de refeição.",
    href: "/pets/new",
    icon: UtensilsCrossed,
    cta: "Começar",
  },
] as const;

export function WelcomeFlow() {
  return (
    <Card className="border-violet-200 dark:border-violet-900/40">
      <CardHeader>
        <CardTitle className="text-lg">Bem-vindo ao boris.app</CardTitle>
        <p className="text-sm text-muted-foreground">
          Siga estes 3 passos para começar a acompanhar seu felino.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {STEPS.map(({ step, title, description, href, icon: Icon, cta }) => (
          <div
            key={step}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {step}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{title}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              </div>
            </div>
            <Button asChild variant={step === 1 ? "default" : "outline"} className="shrink-0 w-full sm:w-auto">
              <Link href={href}>{cta}</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
