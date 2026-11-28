import { expect, signIn, test } from "./fixtures.ts";

test.describe("Smoke", () => {
  test("guest lands on Explore with the site header", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/explore$/);
    await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();
    await expect(page.getByRole("img", { name: "WAYWO home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("signed-in user lands on Home", async ({ page, makerUser }) => {
    await signIn(page, makerUser);
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
