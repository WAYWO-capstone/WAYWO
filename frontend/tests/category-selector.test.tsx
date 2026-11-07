// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ProjectCategory } from "../src/api/models";
import { CategorySelector } from "../src/components/projects/category-selector";

const categories: ProjectCategory[] = [
  { id: "woodworking", name: "Woodworking", description: "Wood projects." },
  { id: "electronics", name: "Electronics", description: "Electronic projects." },
];

afterEach(cleanup);

describe("CategorySelector", () => {
  test("shows all categories in the dropdown and filters them as the user searches", () => {
    render(<CategorySelector categories={categories} value="woodworking" onChange={vi.fn()} />);

    const search = screen.getByRole("combobox", { name: "Search categories" });
    expect((search as HTMLInputElement).value).toBe("Woodworking");
    expect(search.className).toContain("text-sm");
    expect(search.className).not.toContain("text-base");
    fireEvent.focus(search);

    expect((search as HTMLInputElement).value).toBe("");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("option", { name: "Electronics" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Woodworking" }).getAttribute("aria-selected")).toBe("true");

    fireEvent.change(search, { target: { value: "elect" } });

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Electronics" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Woodworking" })).toBeNull();

    fireEvent.change(search, { target: { value: "unknown" } });
    expect(screen.getByText("No matching categories.")).toBeTruthy();
  });

  test("changes the selected category from the dropdown", () => {
    const onChange = vi.fn();
    render(
      <CategorySelector categories={categories} value="woodworking" onChange={onChange} />,
    );

    fireEvent.focus(screen.getByRole("combobox", { name: "Search categories" }));
    fireEvent.click(screen.getByRole("option", { name: "Electronics" }));

    expect(onChange).toHaveBeenCalledWith("electronics");
  });

  test("selects a search result and clears the search", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CategorySelector categories={categories} value="" onChange={onChange} />,
    );
    const search = screen.getByRole("combobox", { name: "Search categories" });

    fireEvent.focus(search);
    fireEvent.change(search, { target: { value: "wood" } });
    fireEvent.click(screen.getByRole("option", { name: "Woodworking" }));

    expect(onChange).toHaveBeenCalledWith("woodworking");
    expect((search as HTMLInputElement).value).toBe("");
    expect(search.getAttribute("aria-expanded")).toBe("false");
    rerender(<CategorySelector categories={categories} value="woodworking" onChange={onChange} />);
    expect((search as HTMLInputElement).value).toBe("Woodworking");
    expect(screen.queryByRole("button", { name: "Remove Woodworking category" })).toBeNull();
  });
});
