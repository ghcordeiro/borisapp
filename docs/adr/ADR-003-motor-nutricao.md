# ADR-003 — Motor de Nutrição: Funções Puras vs Serviço Externo

**Status:** Aceito  
**Data:** 2026-05-24  
**Contexto:** boris.app MVP — Cálculo de RER/NED

---

## Contexto

O motor de nutrição precisa calcular RER (Resting Energy Requirement) e NED (Necessary Energy Daily) com base no peso e estágio de vida do felino. A questão é onde e como implementar esse cálculo.

---

## Opções Consideradas

### Opção A: Funções TypeScript puras em `/lib/nutrition/`
- Implementação local, sem dependências externas
- Funções puras (sem side effects) → 100% testáveis
- Executam no Server (Server Actions) e no Client (preview em tempo real)
- Zero latência (sem I/O)

### Opção B: API externa / microserviço de nutrição
- Dependência de terceiro ou infra adicional
- Latência de rede em cada cálculo
- Overkill para fórmulas matemáticas simples

### Opção C: Apenas no banco (stored procedures PostgreSQL)
- Lógica espalhada entre banco e aplicação
- Difícil de testar e versionar
- Sem preview em tempo real no formulário

---

## Decisão

**Opção A: Funções TypeScript puras**

---

## Justificativa

1. **Fórmulas estáveis**: RER e NED são fórmulas veterinárias estabelecidas que não mudam — não precisam de serviço externo
2. **Testabilidade**: Funções puras são triviais de testar com Vitest (sem mocks)
3. **Isomorfismo**: A mesma função roda no Server Action (persistência) e no Client (preview em tempo real sem round-trip)
4. **Zero custo operacional**: Sem API externa, sem infra adicional
5. **Auditabilidade**: Todo tutor ou veterinário pode auditar o cálculo no código

---

## Implementação

```
/lib/nutrition/
├── formulas.ts      # Funções puras: calculateRER, calculateNED, distributeMeals
└── formulas.test.ts # Testes unitários Vitest
```

Server Actions em `/lib/actions/nutrition.actions.ts` chamam as funções puras e persistem via Prisma.

---

## Consequências

**Positivas:**
- Lógica de negócio centralizada e versionada no repositório
- Preview instantâneo no formulário (sem API call)
- Suite de testes unitários completa e rápida

**Negativas:**
- Se as fórmulas veterinárias precisarem de atualização, requer deploy da aplicação
- Não é compartilhável com outros serviços (aceitável no MVP)
