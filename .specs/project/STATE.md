# STATE.md — boris.app

> Memória persistente do projeto. Atualizar a cada sessão.

---

## Decisões Tomadas

| Data | Decisão | Racional |
|---|---|---|
| 2026-05-24 | NextAuth.js v5 como solução de auth | Open-source, integração nativa com Next.js App Router, sem custo de terceiro |
| 2026-05-24 | PostgreSQL + Prisma como ORM | Type-safety, migrations automáticas, ecossistema maduro |
| 2026-05-24 | Isolamento multi-tenant por userId | Mais simples para MVP; RLS pode ser adicionado depois |
| 2026-05-24 | `lib/db/access.ts` como helper centralizado de acesso | Evita duplicar verificação de ownership em cada Server Action; suporta PetMember (CAREGIVER) |
| 2026-05-24 | `lib/db/date-utils.ts` para limites de "hoje" | `setHours(0,0,0,0)` local — nunca `toISOString().slice(0,10)` (quebra em fusos ≠ UTC) |
| 2026-05-24 | `serializePet()` como único ponto de serialização Decimal | `JSON.parse(JSON.stringify())` + `parseFloat()` — padrão obrigatório para Client Components |
| 2026-05-24 | `canMutate` calculado no Server Component | Passado como prop para Client Components; evita recalcular permissões no client |
| 2026-05-24 | Idempotência de MealLog por `(petId, mealNumber, dia civil)` | Previne duplo-clique; retorna erro amigável "Refeição já registrada hoje" |
| 2026-05-24 | Meta de água para filhotes: piso de 50 ml só na UI do progress ring | Evita anel vazio/confuso sem alterar meta calculada (peso × 50) |
| 2026-05-24 | `PetInvite.role` persiste role do convite (CAREGIVER/VIEWER) | VIEWER recebe leitura via `canMutate=false` existente |

---

## Bloqueios Ativos

_Nenhum no momento._

---

## Lições Aprendidas

- Motor de nutrição (RER/NED) deve ser uma função pura em `/lib/nutrition/` para facilitar testes unitários.
- Não expor queries Prisma em `page.tsx` — sempre via funções dedicadas em `/lib/db/`.
- Workarounds com `(prisma.x.create as Function)` devem ser removidos imediatamente após `npx prisma generate` — não deixar acumular.
- `getTodayMealStatus` existe como Server Action mas o `DailyStatusScreen` recalcula no client; considerar unificar se precisar de single source of truth.
- Meta de água `pesoKg × 50 ml` produz valores baixos para filhotes pequenos — exibir contexto na UI (`isKitten`) e piso visual de 50 ml no anel de progresso.

---

## Preferências do Usuário

- Stack 100% otimizada para Vercel
- Componentes modulares e desacoplados
- TypeScript estrito em todo o projeto
- Textos de UI em PT-BR

---

## Ideias Adiadas

- Integração com balanças bluetooth para pesagem automática
- IA para análise de sintomas (OpenAI)
- App React Native compartilhando lógica de negócio via monorepo Turborepo
- Editar/desfazer refeições e outros registros após salvar — refeições implementadas (update/delete MealLog)
- Seletor de pet no dashboard de métricas (multi-pet) — implementado
- Campo lote (`lotNumber`) exposto no formulário de vacina — implementado
- Convite familiar com role VIEWER (somente leitura) — implementado

---

_Última atualização: 2026-05-24_
