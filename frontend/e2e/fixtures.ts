// Shared E2E fixtures. Import `test` and `expect` from here instead of "@playwright/test".
// Users and projects are created through the API with unique names, so tests can run in parallel.

import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

export const TEST_PASSWORD = "e2e-Password-123";

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export interface Project {
  id: string;
  title: string;
  author_id: string;
  public: boolean;
}

interface NewProject {
  title?: string;
  publish?: boolean;
  owner?: TestUser;
}

// unique name for each user and project so no clash occurs
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createUser(
  request: APIRequestContext,
  prefix = "maker",
): Promise<TestUser> {
  const username = uniqueName(prefix);
  const email = `${username}@example.com`;

  const register = await request.post("/api/auth/register", {
    data: { username, email, password: TEST_PASSWORD },
  });
  await expect(register).toBeOK();

  const login = await request.post("/api/auth/login", {
    data: { login: username, password: TEST_PASSWORD },
  });
  await expect(login).toBeOK();
  const tokens = await login.json();

  return {
    id: (await register.json()).id,
    username,
    email,
    password: TEST_PASSWORD,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}
export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem("waywo.access_token", user.accessToken);
    localStorage.setItem("waywo.refresh_token", user.refreshToken);
  }, user);
}

export const test = base.extend<{
  makerUser: TestUser;
  otherMaker: TestUser;
  guest: Page;
  createProject: (project?: NewProject) => Promise<Project>;
}>({
  makerUser: async ({ request }, provide) => {
    await provide(await createUser(request, "maker"));
  },

  otherMaker: async ({ request }, provide) => {
    await provide(await createUser(request, "other"));
  },

  // A guest: nobody logged in
  guest: async ({ browser }, provide) => {
    const context = await browser.newContext();
    await provide(await context.newPage());
    await context.close();
  },

  createProject: async ({ request, makerUser }, provide) => {
    await provide(async ({ title, publish, owner = makerUser } = {}) => {
      const headers = { Authorization: `Bearer ${owner.accessToken}` };
      const [category] = await (
        await request.get("/api/projects/categories")
      ).json();

      const created = await request.post("/api/projects", {
        headers,
        data: {
          title: title ?? uniqueName("Project"),
          summary: "Created by an E2E test",
          description: "",
          category_id: category.id,
          tags: [],
        },
      });
      await expect(created).toBeOK();
      const project: Project = await created.json();
      if (!publish) return project;

      const published = await request.post(
        `/api/projects/${project.id}/publish`,
        { headers },
      );
      await expect(published).toBeOK();
      return published.json();
    });
  },
});

export { expect };