# PROJECT.md — boris.app

## Visão

**boris.app** é um SaaS de cuidado intensivo e acompanhamento de saúde para felinos, voltado para tutores que acompanham de perto o desenvolvimento de filhotes ou animais em recuperação.

O produto resolve um problema real: tutores de filhotes ou gatos com condições especiais precisam monitorar peso, nutrição, sintomas e consultas veterinárias de forma organizada — e hoje fazem isso em planilhas, cadernos ou grupos de WhatsApp.

---

## Problema

Tutores dedicados de felinos (especialmente filhotes e animais em tratamento) não têm uma ferramenta específica para:
- Calcular a quantidade exata de ração com base no peso atual e nas fórmulas metabólicas corretas (RER/NED)
- Confirmar refeições em tempo real e ver progresso do dia
- Acompanhar visualmente a curva de ganho de peso ao longo do tempo
- Registrar sintomas, vermifugações, vacinas e consultas em um só lugar
- Compartilhar o acompanhamento com familiares

---

## Usuário-alvo

- **Tutor primário**: pessoa que cuida diretamente do felino, frequentemente em contato com veterinário
- **Cuidador familiar (CAREGIVER)**: membro da família convidado que pode registrar refeições, peso e logs de saúde
- **Visualizador (VIEWER)**: role prevista no schema, fluxo de convite ainda não implementado

---

## Proposta de Valor

> "O tutor confirma com um toque que o pet comeu, vê o histórico de peso crescendo semana a semana, e tem um plano calórico gerado automaticamente por fórmulas veterinárias."

---

## Metas entregues (v1.0 — MVP Core)

1. Autenticação segura (NextAuth.js v5 — Google + GitHub)
2. Cadastro e gestão de múltiplos pets por usuário
3. Motor de nutrição: cálculo automático de RER/NED por peso e estágio de vida
4. Registro de itens de dieta (ração, sachê, complementos) com calorias
5. Distribuição fracionada de refeições com horários personalizados (wakeTime/sleepTime)
6. Dashboard visual com gráfico de evolução de peso
7. Log clínico: sintomas, vermifugações e agenda veterinária

---

## Fases pós-MVP entregues

### Fase 1 — MealLog + Status do Dia
Confirmação de refeições com um toque, barra de progresso diária, status por refeição (servida/atrasada/agora/em breve), escolha de horário real ao registrar.

### Fase 2 — Family Sync
Convite familiar por link (7 dias), membros com role CAREGIVER podem registrar refeições/peso/saúde, página de gerenciamento de membros.

### Fase 3 — Saúde Completa
UI para consultas veterinárias, vermifugação e vacinas; timeline unificada de saúde; alertas de próxima dose.

### Fase 4 — Água + Dashboard de Métricas
Registro de ingestão de água, dashboard com 4 gráficos (peso, refeições/dia, hidratação, score calórico do dia).

---

## Fora de Escopo (atual)

- App mobile nativo
- Integração com dispositivos de pesagem
- Pagamentos / planos premium (Stripe)
- Notificações push ou email
- Exportação de relatórios em PDF
- Upload de foto do pet (apenas URL no schema)

---

## Métricas de Sucesso

- Usuário consegue cadastrar um pet e obter o plano alimentar em < 3 minutos
- Dashboard de peso renderiza com dados reais do banco
- Tutor registra refeição com um toque e vê progresso atualizado
- Zero erros de autenticação em produção no primeiro mês

---

_Última atualização: 2026-05-24_
