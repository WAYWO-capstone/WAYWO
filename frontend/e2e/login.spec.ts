// E2E tests for the /login page.

import { expect, test } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("shows errors when the form is submitted empty", async ({ page }) => {
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Enter your email or username.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("shows an error for wrong credentials", async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid credentials" }),
      }),
    );

    await page.getByLabel("Email or username").fill("maker@example.com");
    await page.getByPlaceholder("Enter your password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toHaveText(
      "Incorrect email, username or password.",
    );
    await expect(page).toHaveURL(/\/login/);
  });
});