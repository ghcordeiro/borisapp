import { test, expect, type Page } from "@playwright/test";

async function loginE2E(page: Page) {
  await page.goto("/api/e2e/login");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

async function createBasicPet(page: Page, name: string): Promise<string> {
  await page.goto("/pets/new");
  await page.getByLabel("Nome *").fill(name);
  await page.getByRole("button", { name: "Cadastrar Pet" }).click();
  await expect(page).toHaveURL(/\/pets\/(?!new)[^/]+$/, { timeout: 15000 });
  const petId = page.url().match(/\/pets\/([^/]+)/)?.[1];
  if (!petId || petId === "new") throw new Error("Pet ID inválido");
  return petId;
}

// Each form row is:
//   <div class="flex items-center justify-between border-t py-3">   ← ROW
//     <div class="flex items-center gap-3">
//       <span>emoji</span>
//       <div>
//         <p class="text-sm font-medium">{label}</p>
//         <p class="text-xs ...">desc</p>
//       </div>
//     </div>
//     <Switch />   ← sibling of the gap-3 div, direct child of ROW
//   </div>
//
// We locate the ROW div by querying a div that:
//   1. has a `p` descendant with exactly the label text
//   2. has a switch role as a direct child
// Using XPath to match the row by its exact border-t class and contain the label text.
function getRowSwitch(page: Page, label: string) {
  // Find the row div that contains the label text AND has a switch.
  // The row divs have class containing "border-t" and "justify-between".
  return page
    .locator("div.border-t", { has: page.locator("p", { hasText: label }) })
    .getByRole("switch");
}

test.describe("Tracking preferences", () => {
  test("dono consegue desligar Hidratação e o bloco some da pet page", async ({ page }) => {
    await loginE2E(page);
    const petId = await createBasicPet(page, "Teste Prefs Hidratação");

    await page.goto(`/pets/${petId}/settings`);
    await expect(page.getByRole("heading", { name: "Configurar tracking" })).toBeVisible();

    await getRowSwitch(page, "Hidratação").click();
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();

    await page.goto(`/pets/${petId}`);
    await page.getByRole("tab", { name: /Crescimento/ }).click();
    await expect(page.getByText("Hidratação hoje")).toHaveCount(0);
  });

  test("desligar os 4 toggles clínicos esconde a tab Saúde", async ({ page }) => {
    await loginE2E(page);
    const petId = await createBasicPet(page, "Teste Prefs Saúde");

    await page.goto(`/pets/${petId}/settings`);
    for (const label of ["Sintomas / observações", "Vermifugação", "Vacinas", "Consultas vet"]) {
      await getRowSwitch(page, label).click();
    }
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Configurações salvas")).toBeVisible();

    await page.goto(`/pets/${petId}`);
    await expect(page.getByRole("tab", { name: /Saúde/ })).toHaveCount(0);
  });
});
