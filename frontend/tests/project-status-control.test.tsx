// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectStatusControl } from "../src/components/projects/project-status-control";

afterEach(cleanup);

describe("ProjectStatusControl", () => {
  test("lets the owner change an active project to completed", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<ProjectStatusControl status="ACTIVE" isOwner isSaving={false} error={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Active" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Project status" }), { target: { value: "COMPLETED" } });

    expect(onChange).toHaveBeenCalledWith("COMPLETED");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Project status" })).toBeNull());
    expect(screen.getByRole("button", { name: "Change project status from Active" })).toBeTruthy();
  });

  test("keeps the status selector open and disabled while saving", () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <ProjectStatusControl status="ACTIVE" isOwner isSaving={false} error={null} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change project status from Active" }));
    rerender(<ProjectStatusControl status="ACTIVE" isOwner isSaving onChange={onChange} error={null} />);

    expect((screen.getByRole("combobox", { name: "Project status" }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByLabelText("Project status").parentElement?.querySelector("svg")).toBeTruthy();
  });

  test("shows an update error and lets the owner try again", () => {
    const onChange = vi.fn().mockRejectedValue(new Error("request failed"));
    const { rerender } = render(
      <ProjectStatusControl status="ACTIVE" isOwner isSaving={false} error={null} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change project status from Active" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Project status" }), { target: { value: "COMPLETED" } });

    rerender(
      <ProjectStatusControl status="ACTIVE" isOwner isSaving={false} error="Could not update the project status. Please try again." onChange={onChange} />,
    );
    expect(screen.getByRole("alert").textContent).toContain("Could not update the project status");
    expect(screen.getByRole("combobox", { name: "Project status" })).toBeTruthy();
  });

  test("does not offer status changes to visitors", () => {
    render(<ProjectStatusControl status="COMPLETED" isOwner={false} isSaving={false} error={null} onChange={vi.fn()} />);

    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /change project status/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Project status" })).toBeNull();
  });

  test("lets the owner restore an archived project to active", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<ProjectStatusControl status="ARCHIVED" isOwner isSaving={false} error={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Archived" }));
    fireEvent.click(screen.getByRole("button", { name: "Project status" }));

    expect(onChange).toHaveBeenCalledWith("ACTIVE");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Project status" })).toBeNull());
    expect(screen.getByRole("button", { name: "Change project status from Archived" })).toBeTruthy();
  });

  test("keeps restore available and shows an error when restoring fails", async () => {
    const onChange = vi.fn().mockRejectedValue(new Error("request failed"));
    const { rerender } = render(
      <ProjectStatusControl status="ARCHIVED" isOwner isSaving={false} error={null} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Archived" }));
    fireEvent.click(screen.getByRole("button", { name: "Project status" }));
    rerender(
      <ProjectStatusControl status="ARCHIVED" isOwner isSaving={false} error="Could not update the project status. Please try again." onChange={onChange} />,
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("ACTIVE"));
    expect(screen.getByRole("button", { name: "Project status" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Could not update the project status");
  });

  test("disables restore while the archived project is saving", () => {
    render(<ProjectStatusControl status="ARCHIVED" isOwner isSaving error={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Archived" }));

    expect((screen.getByRole("button", { name: "Project status" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("lets the owner publish a draft by changing it to active", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<ProjectStatusControl status="DRAFT" isOwner isSaving={false} error={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Draft" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Project status" }), { target: { value: "ACTIVE" } });

    expect(onChange).toHaveBeenCalledWith("ACTIVE");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Project status" })).toBeNull());
  });

  test("lets the owner mark a draft completed", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<ProjectStatusControl status="DRAFT" isOwner isSaving={false} error={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Draft" }));
    const status = screen.getByRole("combobox", { name: "Project status" });
    expect(screen.getByRole("option", { name: "Completed" })).toBeTruthy();
    fireEvent.change(status, { target: { value: "COMPLETED" } });

    expect(onChange).toHaveBeenCalledWith("COMPLETED");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Project status" })).toBeNull());
  });

  test("does not offer archiving as a direct draft status change", () => {
    render(<ProjectStatusControl status="DRAFT" isOwner isSaving={false} error={null} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Change project status from Draft" }));

    expect(screen.getByRole("option", { name: "Draft" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Active" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Completed" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Archive project" })).toBeNull();
  });
});
