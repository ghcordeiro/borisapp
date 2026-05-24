"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm() {
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSignIn = async (provider: "google" | "github") => {
    setIsLoading(provider);
    await signIn(provider, { callbackUrl: "/dashboard" });
    setIsLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar na sua conta</CardTitle>
        <CardDescription>
          Escolha um método de autenticação para continuar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button
          variant="outline"
          onClick={() => handleSignIn("google")}
          disabled={isLoading !== null}
          className="w-full"
        >
          {isLoading === "google" ? "Conectando..." : "Continuar com Google"}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSignIn("github")}
          disabled={isLoading !== null}
          className="w-full"
        >
          {isLoading === "github" ? "Conectando..." : "Continuar com GitHub"}
        </Button>
        {process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED === "true" && (
          <Button
            variant="secondary"
            onClick={async () => {
              setIsLoading("e2e");
              await signIn("e2e", {
                email: "e2e@test.com",
                redirectTo: "/dashboard",
              });
              setIsLoading(null);
            }}
            disabled={isLoading !== null}
            className="w-full"
          >
            Entrar (modo teste E2E)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
