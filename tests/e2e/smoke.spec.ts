import { test, expect } from "@playwright/test";

test.describe("Autenticación", () => {
  test("la página de login muestra el botón de Google", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByText("Sistema de Gestión Documental de Cotecnova."),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: /iniciar sesión con google/i }),
    ).toBeVisible();
  });

  test("una ruta privada redirige a /login sin sesión", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});
