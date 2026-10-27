import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { UpdateTimeline } from "@/components/projects/update-item";
import { updateTypeStyles } from "@/components/projects/update-types";
import type { ProjectUpdate } from "@/api/models";

function makeUpdate(overrides: Partial<ProjectUpdate> = {}): ProjectUpdate {
  return {
    id: "u1",
    project_id: "p1",
    author_id: "a1",
    title: "Base finished",
    body: "Finished the base.",
    type: "PROGRESS",
    public: true,
    created_at: "2026-05-14T12:00:00Z",
    updated_at: "2026-05-14T12:00:00Z",
    author: { username: "Anna Ji", profile_picture_link: null },
    ...overrides,
  };
}

describe("UpdateTimeline", () => {
  test("shows each update's title, type, author and body in order", () => {
    const html = renderToStaticMarkup(
      <UpdateTimeline
        updates={[
          makeUpdate({ id: "u2", title: "Second", type: "DECISION", author: { username: "Ben", profile_picture_link: null } }),
          makeUpdate(),
        ]}
      />,
    );

    expect(html.indexOf("Second")).toBeLessThan(html.indexOf("Base finished"));
    expect(html).toContain("Decision");
    expect(html).toContain("Progress");
    expect(html).toContain("Ben");
    expect(html).toContain("Anna Ji");
    expect(html).toContain("Finished the base.");
  });

  test("marks private updates", () => {
    expect(renderToStaticMarkup(<UpdateTimeline updates={[makeUpdate({ public: false })]} />)).toContain("Private");
    expect(renderToStaticMarkup(<UpdateTimeline updates={[makeUpdate()]} />)).not.toContain("Private");
  });

  test("uses the theme color for each update type", () => {
    expect(updateTypeStyles.PROBLEM.className).toBe("bg-update-problem");
    expect(updateTypeStyles.SOLUTION.className).toBe("bg-update-solution");
    const html = renderToStaticMarkup(<UpdateTimeline updates={[makeUpdate({ type: "PROBLEM" })]} />);
    expect(html).toContain("Problem");
    expect(html).toContain("bg-update-problem");
  });
});
