# Spec — MVP Core (boris.app)

> **Status:** Concluído — 2026-05-24

## System Process Context

```
Tutor → Cadastra pet → Sistema calcula RER/NED → Tutor registra alimentos
                                                 → Sistema gera distribuição de refeições
Tutor → Registra peso → Dashboard exibe curva de crescimento
Tutor → Registra sintoma/vermifugação/consulta → Log clínico salvo
```

---

## User Stories & Acceptance Criteria

---

### US-001 — Autenticação

**Como** tutor, **quero** entrar na plataforma com minha conta Google ou GitHub, **para** acessar meus dados de forma segura.

**ACs:**
- [AC-001-1] O usuário pode autenticar via Google OAuth
- [AC-001-2] O usuário pode autenticar via GitHub OAuth
- [AC-001-3] Rotas `/dashboard` e `/pets/*` redirecionam para `/login` se não autenticado
- [AC-001-4] Após login, o usuário é redirecionado para `/dashboard`
- [AC-001-5] O usuário pode fazer logout e é redirecionado para `/login`

---

### US-002 — Gestão de Pets

**Como** tutor, **quero** cadastrar e gerenciar meus felinos, **para** acompanhar cada um individualmente.

**ACs:**
- [AC-002-1] O tutor pode criar um pet com: nome (obrigatório), raça, data de nascimento, gênero, foto (URL), observações
- [AC-002-2] O dashboard lista todos os pets ativos do usuário
- [AC-002-3] Cada card de pet exibe: nome, último peso registrado e raça
- [AC-002-4] O tutor pode editar os dados de um pet
- [AC-002-5] O tutor pode desativar (soft delete) um pet
- [AC-002-6] Um tutor não pode ver ou modificar pets de outro tutor

---

### US-003 — Motor de Nutrição

**Como** tutor, **quero** que o sistema calcule automaticamente as calorias diárias do meu pet, **para** saber exatamente quanto alimentá-lo.

**ACs:**
- [AC-003-1] Ao informar o peso (kg) e estágio de vida, o sistema calcula o RER: `70 × (pesoKg ^ 0.75)`
- [AC-003-2] Para pesos < 2 kg, aplica a fórmula linear: `30 × pesoKg + 70`
- [AC-003-3] O NED é calculado como `RER × fatorEnergetico` (fator varia por estágio de vida)
- [AC-003-4] O tutor pode cadastrar itens de dieta (nome, tipo, kcal/100g)
- [AC-003-5] O sistema calcula automaticamente os gramas diários necessários por item
- [AC-003-6] O sistema gera a distribuição fracionada de refeições (2, 3 ou 4 vezes/dia)
- [AC-003-7] Apenas um plano alimentar pode estar ativo por pet
- [AC-003-8] O formulário de criação de plano exibe preview em tempo real do NED

---

### US-004 — Health & Growth Tracker

**Como** tutor, **quero** registrar pesagens periódicas e visualizar a curva de crescimento, **para** monitorar o desenvolvimento do meu filhote.

**ACs:**
- [AC-004-1] O tutor pode registrar o peso atual do pet (em kg ou gramas)
- [AC-004-2] O dashboard exibe um gráfico de linha com a evolução de peso ao longo do tempo
- [AC-004-3] O gráfico mostra datas no eixo X e peso (g) no eixo Y
- [AC-004-4] O histórico de pesagens fica disponível em ordem cronológica
- [AC-004-5] O sistema armazena data e hora exata de cada pesagem

---

### US-005 — Logs Clínicos

**Como** tutor, **quero** registrar sintomas, vermifugações e consultas, **para** ter um histórico clínico completo do meu felino.

**ACs:**
- [AC-005-1] O tutor pode registrar um sintoma com: descrição, severidade (baixa/média/alta/crítica), data de ocorrência
- [AC-005-2] O tutor pode registrar uma vermifugação com: produto, dose (mg), data de aplicação, data da próxima dose
- [AC-005-3] O tutor pode agendar consultas veterinárias com: título, nome do vet, clínica, data/hora
- [AC-005-4] Consultas aparecem na HealthTimeline em ordem cronológica unificada com demais eventos de saúde (sintomas, vermifugação, vacinas); consultas futuras listadas antes do histórico na seção dedicada
- [AC-005-5] O log clínico exibe os 20 eventos mais recentes em ordem cronológica reversa

---

## Fora de Escopo (MVP)

- Compartilhamento de perfil com veterinário
- Notificações por email ou push
- Exportação de relatórios
- Planos de assinatura
- App mobile

---

## Non-Functional Requirements

- **Performance**: Página de dashboard deve carregar em < 2s (LCP)
- **Segurança**: Toda route handler e server action valida autenticação
- **Acessibilidade**: WCAG 2.1 AA nas telas principais
- **Deploy**: 100% compatível com Vercel (sem Docker, sem servidor customizado)
