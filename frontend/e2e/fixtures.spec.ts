// To check parallel runs don't clash run:
    // bun run test:e2e e2e/fixtures.spec.ts --repeat-each=2 --workers=2

import { expect, signIn, test } from "./fixtures.ts";

test("fixtures create separate users and projects", async ({
  page,
  makerUser,
  otherMaker,
  guest,
  createProject,
}) => {
  expect(makerUser.username).not.toBe(otherMaker.username);

  const draft = await createProject();
  const published = await createProject({ owner: otherMaker, publish: true });
  expect(draft.author_id).toBe(makerUser.id);
  expect(published.author_id).toBe(otherMaker.id);
  expect(published.public).toBe(true);

  await signIn(page, makerUser);
  await page.goto(`/view-project?projectId=${draft.id}`);
  await expect(page.getByRole("heading", { name: draft.title })).toBeVisible();

  await guest.goto(`/view-project?projectId=${published.id}`);
  await expect(
    guest.getByRole("heading", { name: published.title }),
  ).toBeVisible();
  await expect(guest.getByRole("link", { name: "Log in" })).toBeVisible();
});