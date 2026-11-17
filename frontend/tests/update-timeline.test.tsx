import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { UpdateTimeline } from "@/components/projects/update-item";
import { updateTypeStyles } from "@/components/projects/update-types";
import type { ProjectUpdate } from "@/api/models";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    resetScroll: _resetScroll,
    ...props
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
    resetScroll?: boolean;
  }) => (
    <a href={`${to}?${new URLSearchParams(search)}`} {...props}>
      {children}
    </a>
  ),
}));

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

  test("shows outgoing and incoming links to their target updates", () => {
    const update = makeUpdate({
      outgoing_references: [
        {
          linked_update_id: "problem-1",
          title: "Corners are lumpy",
          type: "PROBLEM",
          reason: "SOLVES",
        },
      ],
      incoming_references: [
        {
          linked_update_id: "solution-1",
          title: "Reinforced the corners",
          type: "SOLUTION",
          reason: "SOLVED_BY",
        },
      ],
    });

    const html = renderToStaticMarkup(
      <UpdateTimeline updates={[update]} projectId="p1" />,
    );

    expect(html).toContain("Solves");
    expect(html).toContain("Solved by");
    expect(html).toContain("Corners are lumpy");
    expect(html).toContain("Reinforced the corners");
    expect(html).toContain("bg-update-problem");
    expect(html).toContain("bg-update-solution");
    expect(html).toContain(
      'href="/view-project?projectId=p1&amp;updateId=problem-1"',
    );
    expect(html).toContain(
      'href="/view-project?projectId=p1&amp;updateId=solution-1"',
    );
    const problemLink = html.slice(
      html.indexOf('href="/view-project?projectId=p1&amp;updateId=problem-1"'),
      html.indexOf("</a>", html.indexOf('href="/view-project?projectId=p1&amp;updateId=problem-1"')),
    );
    expect(problemLink.indexOf("Solves")).toBeLessThan(
      problemLink.indexOf("Corners are lumpy"),
    );
    expect(problemLink.indexOf("Corners are lumpy")).toBeLessThan(
      problemLink.indexOf("Problem"),
    );
    expect(problemLink).toContain(
      "font-semibold text-brand-garnet",
    );
    expect(problemLink).not.toContain("#Corners");
    expect(html).not.toContain("Links:");
  });
});
