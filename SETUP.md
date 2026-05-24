# boris.app — Guia de Setup

## Pré-requisitos

- Node.js 20+
- pnpm (recomendado) ou npm
- Conta no [Neon](https://neon.tech) (PostgreSQL serverless)
- App OAuth no [Google Cloud Console](https://console.cloud.google.com)

---

## 1. Criar o projeto Next.js

```bash
npx create-next-app@latest boris-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd boris-app
```

## 2. Instalar dependências

```bash
npm install @auth/prisma-adapter @prisma/client next-auth@beta \
  recharts zod date-fns lucide-react \
  class-variance-authority clsx tailwind-merge tailwindcss-animate \
  @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator \
  @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-toast \
  @radix-ui/react-tooltip

npm install -D prisma tsx vitest
```

## 3. Instalar componentes Shadcn UI

```bash
npx shadcn@latest init
# Escolha: Default theme, CSS variables: yes

# Instalar componentes usados
npx shadcn@latest add button card avatar dropdown-menu tabs
npx shadcn@latest add input label select separator toast tooltip
```

## 4. Configurar banco de dados (Neon)

1. Crie um projeto no [Neon Console](https://console.neon.tech)
2. Copie a connection string do dashboard
3. Configure o `.env.local`:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/boris_app?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/boris_app?sslmode=require"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_GOOGLE_ID="seu-google-client-id"
AUTH_GOOGLE_SECRET="seu-google-client-secret"
```

## 5. Configurar OAuth Google

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto → APIs & Serviços → Credenciais
3. "Criar credenciais" → "ID do cliente OAuth"
4. Tipo: Aplicativo da Web
5. URIs autorizados de redirecionamento: `http://localhost:3000/api/auth/callback/google`
6. Copie Client ID e Client Secret para `.env.local`

## 6. Inicializar Prisma e rodar migrations

```bash
# Gerar o Prisma Client
npx prisma generate

# Criar as tabelas no banco
npx prisma db push

# (opcional) Abrir o Prisma Studio
npx prisma studio
```

## 7. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 8. Rodar os testes

```bash
npm test
# ou
npx vitest lib/nutrition/formulas.test.ts
```

---

## Deploy na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Configurar variáveis de ambiente no dashboard da Vercel:
# - DATABASE_URL (pooled connection do Neon)
# - DIRECT_URL  
# - AUTH_SECRET
# - AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
# - NEXTAUTH_URL (sua URL de produção)
```

**Integração Neon + Vercel:**
No dashboard da Vercel → Storage → Add → Neon Postgres
Isso configura as variáveis de ambiente automaticamente.

---

## Estrutura de Arquivos Gerados

```
boris-app/
├── .specs/                          # Documentação SDD
│   ├── project/
│   │   ├── CONSTITUTION.md
│   │   ├── PROJECT.md
│   │   ├── ROADMAP.md
│   │   └── STATE.md
│   └── features/mvp-core/
│       └── spec.md
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               # Guard de autenticação
│   │   ├── dashboard/page.tsx       # Lista de pets
│   │   └── pets/
│   │       ├── [petId]/page.tsx     # Perfil do pet
│   │       └── new/page.tsx         # Cadastrar pet
│   ├── api/auth/[...nextauth]/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── auth/login-form.tsx
│   ├── dashboard/sidebar.tsx
│   ├── dashboard/header.tsx
│   └── tracker/weight-chart.tsx
├── docs/adr/                        # Architecture Decision Records
│   ├── ADR-001-autenticacao.md
│   ├── ADR-002-banco-de-dados.md
│   └── ADR-003-motor-nutricao.md
├── lib/
│   ├── auth.ts                      # NextAuth config
│   ├── env.ts                       # Validação de env vars
│   ├── utils.ts                     # Utilitários
│   ├── actions/
│   │   ├── pets.actions.ts          # Server Actions: pets
│   │   └── nutrition.actions.ts     # Server Actions: nutrição
│   ├── db/
│   │   ├── client.ts                # Prisma singleton
│   │   └── pets.ts                  # Queries: pets
│   └── nutrition/
│       ├── formulas.ts              # Motor RER/NED (funções puras)
│       └── formulas.test.ts         # Testes unitários
├── middleware.ts                    # Proteção de rotas
├── prisma/schema.prisma             # Schema do banco
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── .env.example
```

---

## Testes E2E (Playwright)

Requer banco PostgreSQL configurado (`.env` com `DATABASE_URL`).

```bash
# Instalar browser (primeira vez)
npx playwright install chromium

# Rodar smoke tests (sobe dev server dedicado com auth E2E habilitado)
npm run test:e2e
```

Login de teste via `GET /api/e2e/login` (somente com `E2E_AUTH_ENABLED=true`).
