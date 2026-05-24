import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { userHasPetReadAccess } from "@/lib/db/access";

interface RouteParams {
  params: Promise<{ petId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { petId } = await params;
  const hasAccess = await userHasPetReadAccess(petId, session.user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const pet = await prisma.pet.findUnique({
    where: { id: petId },
    include: {
      weightLogs: {
        where: { loggedAt: { gte: sevenDaysAgo } },
        orderBy: { loggedAt: "asc" },
      },
      mealLogs: {
        where: { servedAt: { gte: sevenDaysAgo } },
        orderBy: { servedAt: "asc" },
      },
      vaccines: {
        where: {
          OR: [
            { nextDueAt: { gte: new Date() } },
            { appliedAt: { gte: sevenDaysAgo } },
          ],
        },
        orderBy: { nextDueAt: "asc" },
      },
      dietPlans: { where: { isActive: true }, take: 1 },
    },
  });

  if (!pet) {
    return NextResponse.json({ error: "Pet não encontrado" }, { status: 404 });
  }

  const mealsByDay = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    mealsByDay.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const log of pet.mealLogs) {
    const key = format(log.servedAt, "yyyy-MM-dd");
    if (mealsByDay.has(key)) {
      mealsByDay.set(key, (mealsByDay.get(key) ?? 0) + 1);
    }
  }

  const doc = new jsPDF();
  const lineHeight = 7;
  let y = 20;

  function addLine(text: string, bold = false) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, 14, y);
    y += lineHeight;
  }

  addLine(`Relatório — ${pet.name}`, true);
  addLine(
    `Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`
  );
  addLine(`Período: últimos 7 dias`);
  y += 3;

  addLine("Peso", true);
  if (pet.weightLogs.length === 0) {
    addLine("  Sem pesagens no período");
  } else {
    for (const w of pet.weightLogs) {
      addLine(
        `  ${format(w.loggedAt, "dd/MM", { locale: ptBR })}: ${(Number(w.weightKg) * 1000).toFixed(0)}g`
      );
    }
  }
  y += 3;

  addLine("Refeições por dia", true);
  for (const [day, count] of mealsByDay) {
    addLine(
      `  ${format(new Date(day), "EEE dd/MM", { locale: ptBR })}: ${count} refeições`
    );
  }
  y += 3;

  addLine("Vacinas / reforços", true);
  if (pet.vaccines.length === 0) {
    addLine("  Nenhuma vacina relevante no período");
  } else {
    for (const v of pet.vaccines) {
      const due = v.nextDueAt
        ? ` — reforço ${format(v.nextDueAt, "dd/MM/yyyy", { locale: ptBR })}`
        : "";
      addLine(`  ${v.name} (${format(v.appliedAt, "dd/MM/yyyy", { locale: ptBR })})${due}`);
    }
  }

  const plan = pet.dietPlans[0];
  if (plan) {
    y += 3;
    addLine("Plano ativo", true);
    addLine(`  ${Number(plan.nedKcal).toFixed(0)} kcal/dia · ${plan.mealsPerDay} refeições`);
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="boris-${pet.name.replace(/\s+/g, "-").toLowerCase()}-7d.pdf"`,
    },
  });
}
