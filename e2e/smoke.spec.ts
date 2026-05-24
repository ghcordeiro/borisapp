import { test, expect, type Page } from "@playwright/test";

async function loginE2E(page: Page) {
  await page.goto("/api/e2e/login");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

async function createPetWithPlan(page: Page, name: string) {
  await page.goto("/pets/new");
  await page.getByLabel("Nome *").fill(name);
  await page.getByRole("button", { name: "Cadastrar Pet" }).click();
  await expect(page).toHaveURL(/\/pets\/(?!new)[^/]+$/, { timeout: 15000 });

  const petId = page.url().match(/\/pets\/([^/]+)/)?.[1];
  if (!petId || petId === "new") throw new Error("Pet ID inválido");

  await page.getByRole("button", { name: "+ Criar Plano Alimentar" }).click();
  await page.getByLabel("Peso atual (kg) *").fill("0.345");
  await page.getByLabel(/acorda/i).fill("00:01");
  await page.getByLabel(/dorme/i).fill("23:59");
  await page.getByRole("combobox").filter({ hasText: /selecione/i }).click();
  await page.getByRole("option", { name: /filhote/i }).first().click();
  await page.getByRole("button", { name: "Criar Plano" }).click();
  await expect(page.getByText("Status de hoje")).toBeVisible({ timeout: 20000 });

  return petId;
}

test.describe("Smoke — autenticação", () => {
  test("página de login carrega", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /boris\.app/i })).toBeVisible();
    await expect(page.getByText("Entrar na sua conta")).toBeVisible();
  });

  test("dashboard redireciona para login sem sessão", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login E2E abre dashboard", async ({ page }) => {
    await page.goto("/api/e2e/login");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /Meus Felinos/i })).toBeVisible();
  });
});

test.describe("Smoke — fluxos autenticados", () => {
  test.beforeEach(async ({ page }) => {
    await loginE2E(page);
  });

  test("registrar refeição na página do pet", async ({ page }) => {
    const petId = await createPetWithPlan(page, `Boris Meal ${Date.now()}`);

    const serveButton = page
      .getByRole("button", { name: /dei agora|registrar mesmo assim/i })
      .first();
    await expect(serveButton).toBeVisible({ timeout: 15000 });
    await serveButton.click();
    await page.getByLabel(/horário em que serviu/i).fill("12:00");
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page.getByText(/refeição registrada|servido às/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("convite familiar copia link", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const petId = await createPetWithPlan(page, `Boris Invite ${Date.now()}`);
    await page.getByRole("link", { name: /família/i }).click();
    await expect(page).toHaveURL(new RegExp(`/pets/${petId}/members`));

    await page.getByRole("button", { name: /convidar familiar/i }).click();
    await page.locator("#invite-role").selectOption("VIEWER");
    await page.getByRole("button", { name: /copiar link/i }).click();
    await expect(page.getByText(/link copiado|copiado/i)).toBeVisible({ timeout: 5000 });
  });
});
