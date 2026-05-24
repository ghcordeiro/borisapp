import { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-violet-700 dark:text-violet-400">
            boris.app 🐱
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cuidado intensivo para o seu felino
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
