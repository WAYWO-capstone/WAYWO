import { expect, test } from "@playwright/test";

test.describe("Smoke", () => {
  test("home page loads with the site header", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("img", { name: "WAYWO home" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("header Log in link opens the login page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Log in to WAYWO." }),
    ).toBeVisible();
  });
});