# ROADMAP.md — boris.app

## Milestone 0 — Fundação

**Status:** Concluído

- [x] Definição de stack e arquitetura
- [x] Schema Prisma (entidades core)
- [x] Estrutura de diretórios Next.js App Router
- [x] Motor de nutrição RER/NED
- [x] Setup inicial do projeto (`npx create-next-app`)
- [x] Configuração Prisma + PostgreSQL local
- [x] Configuração NextAuth.js

---

## Milestone 1 — MVP Core

**Status:** Concluído

### Feature: Gestão de Pets
- [x] CRUD de pets (Nome, Nascimento, Raça, Peso)
- [x] Listagem de pets do usuário
- [ ] Foto do pet (upload via Vercel Blob ou URL) — apenas URL no schema, sem upload

### Feature: Motor de Nutrição
- [x] Tela de configuração do plano alimentar
- [x] Cálculo automático RER/NED ao informar peso
- [x] Cadastro de itens de dieta (ração, sachê) com kcal
- [x] Geração da distribuição fracionada por horário (inclui rotina wakeTime/sleepTime)

### Feature: Health & Growth Tracker
- [x] Registro de pesagens (WeightLog)
- [x] Gráfico de curva de peso com Recharts
- [x] Alerta visual para ganho/perda além do esperado (header do pet)

### Feature: Logs Clínicos
- [x] Registro de sintomas com data e descrição
- [x] Controle de vermifugação (data, produto, dose) — UI completa na Fase 3
- [x] Agenda veterinária (próximas consultas) — UI completa na Fase 3

---

## Milestone 2 — Tracking & Family (Fases 1–4)

**Status:** Concluído

### Fase 1 — MealLog + Status do Dia
- [x] Modelo `MealLog` + migration
- [x] Server Action `logMeal` com idempotência por dia
- [x] `DailyStatusScreen` com progresso, status por refeição e botão "Dei agora"
- [x] Escolha de horário real ao registrar refeição (`servedAt`)

### Fase 2 — Family Sync
- [x] Modelos `PetMember` + `PetInvite` + enum `MemberRole`
- [x] Convite por link (7 dias), aceite e listagem de membros
- [x] Controle de acesso expandido (`lib/db/access.ts`) para CAREGIVER
- [x] Role VIEWER no fluxo de convite (schema existe, convite cria só CAREGIVER)

### Fase 3 — Saúde Completa
- [x] Modelo `Vaccine` + UI de registro e listagem
- [x] UI de consultas veterinárias (agendar, concluir, cancelar)
- [x] UI de vermifugação com destaque de próxima dose
- [x] `HealthTimeline` unificada (sintomas + consultas + vermifugação + vacinas)
- [x] Campo `lotNumber` no formulário de vacina (existe no schema, falta na UI)

### Fase 4 — Água + Dashboard de Métricas
- [x] Modelo `WaterLog` + `logWater`
- [x] `MetricsDashboard` com 4 gráficos Recharts (peso, refeições, hidratação, score do dia)
- [x] Registro de água no dashboard
- [x] Registro de água na página do pet
- [x] Seletor de pet no dashboard (hoje usa apenas `pets[0]`)

---

## Milestone 3 — Polimento & UX

**Status:** Concluído

- [x] Onboarding guiado (primeiro pet)
- [x] Exportação de relatório em PDF
- [x] Dark mode
- [x] Responsividade mobile completa
- [x] Testes E2E com Playwright
- [x] Editar/desfazer refeições e outros registros
- [x] Gramas reais (`actualGrams`) e notas ao registrar refeição

---

## Milestone 4 — Monetização & Notificações

**Status:** Futuro

- [ ] Planos de assinatura (Stripe)
- [ ] Notificações por email (vermifugação, consulta, refeição atrasada)

---

## Decisões Técnicas Abertas

| Decisão | Status | ADR |
|---|---|---|
| NextAuth.js vs Clerk | Definido: NextAuth.js v5 | ADR-001 |
| Storage de imagens (Vercel Blob vs URL) | Pendente — não bloqueia | - |
| Cache strategy (Redis vs ISR) | Pendente — não bloqueia | - |

---

_Última atualização: 2026-05-24_
