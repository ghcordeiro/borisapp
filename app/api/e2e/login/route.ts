import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";

export async function GET(request: Request) {
  if (process.env.E2E_AUTH_ENABLED !== "true") {
    return new Response("E2E auth disabled", { status: 403 });
  }

  const email = "e2e@test.com";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "E2E User",
      emailVerified: new Date(),
    },
  });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  const baseUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL("/dashboard", baseUrl.origin));

  response.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return response;
}
