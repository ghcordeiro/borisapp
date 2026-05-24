# CONSTITUTION.md — boris.app

> Leis imutáveis do projeto. Qualquer violação é um bug, não uma troca de opinião.

---

## 1. Stack Canônica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript estrito (`strict: true`) |
| UI | Tailwind CSS + Shadcn UI |
| Gráficos | Recharts |
| ORM / DB | Prisma ORM + PostgreSQL |
| Autenticação | NextAuth.js (Auth.js v5) |
| Deploy | Vercel (edge-compatible onde possível) |

**Nenhuma dessas escolhas é negociável sem um ADR aprovado.**

---

## 2. Regras de Arquitetura

### 2.1 App Router — Separação Server / Client
- Componentes são **Server Components por padrão**.
- `"use client"` só entra quando há interatividade (estado, eventos, browser APIs).
- Nunca colocar lógica de negócio em Client Components — toda regra vai em Server Actions ou Route Handlers.

### 2.2 Server Actions
- Toda mutação de dados (create, update, delete) usa **Server Actions** (`"use server"`).
- Server Actions ficam em `/lib/actions/` com um arquivo por domínio (ex: `pet.actions.ts`).
- Validação de input obrigatória com **Zod** antes de qualquer acesso ao Prisma.

### 2.3 Prisma
- Schema em `prisma/schema.prisma` — fonte única de verdade do modelo de dados.
- Nunca fazer queries Prisma em Client Components ou em `page.tsx` diretamente — sempre via funções em `/lib/db/` ou Server Actions.
- Migrations geradas com `prisma migrate dev` — nunca editar arquivos de migration manualmente.

### 2.4 Multi-Tenancy
- Isolamento por `userId`: todo registro pertence a um `User` e queries sempre filtram por `userId` da sessão.
- RLS (Row-Level Security) no PostgreSQL é desejável a longo prazo mas não obrigatório no MVP.

### 2.5 Autenticação
- Toda rota dentro de `/(dashboard)` é protegida — middleware de autenticação obrigatório.
- Nunca expor dados de outros usuários — sempre validar `session.user.id === recurso.userId`.

---

## 3. Regras de Código

- **TypeScript estrito**: `strict: true`, sem `any` explícito. Use `unknown` quando necessário.
- **Sem barrel exports circulares**: imports diretos de arquivo quando houver risco de ciclo.
- **Nomes em inglês** para código (variáveis, funções, tipos, arquivos). Comentários e documentação podem ser em português.
- **Componentes Shadcn**: não modificar os arquivos em `/components/ui/` diretamente — compor por cima.
- **Variáveis de ambiente**: todas expostas via `/lib/env.ts` com validação Zod. Nunca acessar `process.env` diretamente fora desse arquivo.

---

## 4. Segurança

- Nunca logar dados sensíveis (senhas, tokens, dados de saúde).
- Todas as Server Actions validam a sessão antes de qualquer operação.
- Inputs sanitizados via Zod — nunca confiar em dados do cliente.
- Headers de segurança configurados no `next.config.ts`.

---

## 5. Performance

- Imagens via `next/image` sempre.
- Fontes via `next/font` sempre.
- `loading.tsx` e `error.tsx` em cada segmento de rota do dashboard.
- Prefira `generateStaticParams` e cache de dados onde possível.

---

## 6. Convenções de Arquivo

```
/app                    → rotas e layouts (App Router)
/components             → componentes reutilizáveis (não-UI-lib)
/components/ui          → componentes Shadcn (não editar)
/lib/actions            → Server Actions por domínio
/lib/db                 → queries Prisma por domínio
/lib/validations        → schemas Zod
/lib/utils              → utilitários puros
/lib/nutrition          → motor de nutrição (cálculos RER/NED)
/types                  → tipos e interfaces TypeScript
/hooks                  → Client hooks (useXxx)
/prisma                 → schema.prisma e migrations
```

---

_Última atualização: 2026-05-24 | Versão: 1.1_
