# ADR-001 — Estratégia de Autenticação: NextAuth.js v5 vs Clerk

**Status:** Aceito  
**Data:** 2026-05-24  
**Contexto:** boris.app MVP

---

## Contexto

O projeto precisa de uma solução de autenticação robusta, com suporte a OAuth (Google, GitHub) e sessões persistidas em banco de dados. As duas opções mais populares no ecossistema Next.js são NextAuth.js v5 (Auth.js) e Clerk.

---

## Opções Consideradas

### Opção A: NextAuth.js v5 (Auth.js)
- Open-source, sem custo
- Adapter nativo para Prisma (`@auth/prisma-adapter`)
- Sessões armazenadas no PostgreSQL (controle total)
- Configuração manual, mas total flexibilidade
- API estável para App Router (`auth()`, `handlers`, `middleware`)

### Opção B: Clerk
- SaaS pago (free tier limitado)
- UI de login pronta e polida
- Menor curva de aprendizado
- Dados de usuário no Clerk (não no nosso banco)
- Dependência de terceiro para dados críticos

---

## Decisão

**Opção A: NextAuth.js v5**

---

## Justificativa

1. **Custo zero**: Para MVP, eliminar custos operacionais é prioritário
2. **Dados soberanos**: Usuários ficam no nosso PostgreSQL — sem migração futura
3. **Integração nativa com Prisma**: `@auth/prisma-adapter` cria as tabelas automaticamente
4. **Controle de sessão**: Estratégia `database` permite invalidar sessões server-side
5. **Vercel-ready**: Funciona nativamente em Edge e Serverless Functions

---

## Consequências

**Positivas:**
- Sem dependência de SaaS externo para auth
- Schema de usuários totalmente customizável
- Facilita future multi-tenancy granular

**Negativas:**
- UI de login precisa ser construída manualmente (custo de ~2h)
- Gestão de email magic link requer configuração adicional (não no MVP)
- Docs do Auth.js v5 ainda em evolução (beta)

---

## Referências

- [Auth.js v5 Docs](https://authjs.dev)
- [PrismaAdapter Docs](https://authjs.dev/getting-started/adapters/prisma)
