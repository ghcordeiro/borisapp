# ADR-002 — Banco de Dados: PostgreSQL + Prisma com Neon

**Status:** Aceito  
**Data:** 2026-05-24  
**Contexto:** boris.app MVP — Deploy na Vercel

---

## Contexto

O projeto precisa de um banco relacional compatível com Vercel Serverless (sem conexões persistentes de longa duração). As opções avaliadas foram Neon, Supabase e PlanetScale.

---

## Opções Consideradas

### Opção A: Neon (PostgreSQL serverless)
- PostgreSQL 100% compatível
- Conexão via HTTP (sem TCP persistente) — ideal para Serverless
- Free tier generoso
- `directUrl` para migrations, `DATABASE_URL` pooled para runtime
- Branching de banco para preview deployments na Vercel

### Opção B: Supabase
- PostgreSQL + realtime + storage + auth (features que não usaremos)
- Overhead de stack desnecessário para MVP
- Mais complexo de configurar

### Opção C: PlanetScale (MySQL)
- Não é PostgreSQL — Prisma tem quirks com MySQL
- Branching excelente mas desnecessário
- Schema mudanças sem downtime (positivo, mas não crítico no MVP)

---

## Decisão

**Opção A: Neon + PostgreSQL**

---

## Justificativa

1. **Serverless nativo**: Conecta via HTTP, sem timeout de conexão TCP nas Serverless Functions da Vercel
2. **Compatível com Prisma**: `DATABASE_URL` (pooled) + `DIRECT_URL` (direct para migrations) é o padrão documentado
3. **Free tier suficiente para MVP**: 0.5 GB storage, 10 GB de transferência
4. **Preview branches**: Cada PR na Vercel pode ter um branch de banco separado

---

## Configuração Resultante

```env
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/boris_app?sslmode=require
DIRECT_URL=postgresql://...@ep-xxx.neon.tech/boris_app?sslmode=require&pgbouncer=true
```

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## Consequências

**Positivas:**
- Zero problemas de "too many connections" em Serverless
- Migrations funcionam corretamente via `directUrl`
- Integração oficial com Vercel no marketplace

**Negativas:**
- Cold start pode adicionar ~100ms na primeira query
- Free tier tem limite de compute hours (não deve ser problema no MVP)

---

## Referências

- [Neon + Vercel](https://neon.tech/docs/guides/vercel)
- [Prisma + Neon](https://www.prisma.io/docs/guides/database/neon)
