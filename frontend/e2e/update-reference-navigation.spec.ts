import { expect, test } from "@playwright/test";

const project = {
  id: "p1",
  author_id: "a1",
  title: "Router scroll test project",
  summary: "A project for linked update navigation",
  description: "Test project description",
  status: "ACTIVE",
  public: true,
  category: { id: "c1", name: "Crafts", description: "Craft projects" },
  tags: [],
  created_at: "2026-05-14T12:00:00Z",
  last_autosaved_at: null,
  published_at: "2026-05-14T12:00:00Z",
  completed_at: null,
  author: { username: "Test maker", profile_picture_link: null },
  is_owner: false,
};

const updates = [
  {
    id: "source",
    project_id: "p1",
    author_id: "a1",
    title: "Source update",
    body: "A source update that links to another update.",
    type: "PROGRESS",
    public: true,
    created_at: "2026-05-14T12:00:00Z",
    updated_at: "2026-05-14T12:00:00Z",
    author: { username: "Test maker", profile_picture_link: null },
    outgoing_references: [
      {
        linked_update_id: "target",
        title: "Linked update",
        type: "PROGRESS",
        reason: "RELATED_TO",
      },
    ],
    incoming_references: [],
  },
  {
    id: "target",
    project_id: "p1",
    author_id: "a1",
    title: "Linked update",
    body: "The linked update.",
    type: "PROGRESS",
    public: true,
    created_at: "2026-05-13T12:00:00Z",
    updated_at: "2026-05-13T12:00:00Z",
    author: { username: "Test maker", profile_picture_link: null },
    outgoing_references: [],
    incoming_references: [],
  },
];

test("linked update navigation preserves the page scroll position", async ({
  page,
}) => {
  await page.route("**/api/projects/p1", (route) =>
    route.fulfill({ json: project }),
  );
  await page.route("**/api/projects/p1/updates**", (route) =>
    route.fulfill({
      json: { items: updates, total: updates.length, limit: 20, offset: 0 },
    }),
  );

  await page.goto("/view-project?projectId=p1");
  const link = page.getByRole("link", {
    name: "Related to Linked update Progress",
  });
  await expect(link).toBeVisible();
  await page.evaluate(
    "window.scrollTo(0, document.documentElement.scrollHeight)",
  );
  await link.scrollIntoViewIfNeeded();
  const scrollYBeforeNavigation = Number(await page.evaluate("window.scrollY"));
  expect(scrollYBeforeNavigation).toBeGreaterThan(0);

  await link.click();
  await expect(page).toHaveURL(/updateId=target/);
  await expect(page.locator("#update-target")).toHaveClass(/ring-2/);

  const scrollYAfterNavigation = Number(await page.evaluate("window.scrollY"));
  expect(scrollYAfterNavigation).toBe(scrollYBeforeNavigation);
});
