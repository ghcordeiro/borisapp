import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { authConfig } from "@/lib/auth.config";

const e2eProviders =
  process.env.E2E_AUTH_ENABLED === "true"
    ? [
        Credentials({
          id: "e2e",
          name: "E2E Test",
          credentials: {
            email: { label: "Email", type: "email" },
          },
          async authorize(credentials) {
            const email = credentials?.email as string | undefined;
            if (!email) return null;

            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
              user = await prisma.user.create({
                data: { email, name: "E2E User", emailVerified: new Date() },
              });
            }
            return user;
          },
        }),
      ]
    : [];

/**
 * Auth principal com Prisma adapter e sessão em banco de dados.
 * Usado apenas em Server Components, Server Actions e Route Handlers.
 * O middleware usa authConfig separado (sem adapter) para o Edge Runtime.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, ...e2eProviders],
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
  },
  callbacks: {
    ...authConfig.callbacks,
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
