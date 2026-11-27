import { expect, test } from "@playwright/test";

test.describe("Smoke", () => {
  test("guest lands on Explore with the site header", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
    await expect(page.getByRole("img", { name: "WAYWO home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("signed-in user lands on Home", async ({ page }) => {
    await page.addInitScript(() => {
      const payload = btoa(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: "test-user",
        }),
      )
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
      const token = `test.${payload}.signature`;

      localStorage.setItem("waywo.access_token", token);
      localStorage.setItem("waywo.refresh_token", token);
    });

    await page.goto("/");

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });

  test("/api requests reach the backend through the Vite proxy", async ({
    request,
  }) => {
    const response = await request.get("/api/");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      message: "WAYWO backend is running!",
    });
  });

  test("header Log in link opens the login page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Log in to WAYWO" }),
    ).toBeVisible();
  });
});