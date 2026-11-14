// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UploadDropzone } from "@/components/uploads/upload-dropzone";

const file = new File(["solid bracket"], "Bracket.STL");

function setup(props: Partial<Parameters<typeof UploadDropzone>[0]> = {}) {
  const onFiles = vi.fn();
  const view = render(<UploadDropzone onFiles={onFiles} label="Add File" {...props} />);
  const button = screen.getByRole("button", { name: /add file/i });
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onFiles, button, input };
}

afterEach(cleanup);

describe("UploadDropzone", () => {
  test("opens the file picker when clicked", () => {
    const { button, input } = setup();
    const click = vi.spyOn(input, "click");
    fireEvent.click(button);
    expect(click).toHaveBeenCalled();
  });

  test("passes picked files and resets the input", () => {
    const { onFiles, input } = setup();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(input.value).toBe("");
  });

  test("passes dropped files", () => {
    const { onFiles, button } = setup();
    fireEvent.drop(button, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  test("ignores drops when disabled", () => {
    const { onFiles, button } = setup({ disabled: true });
    expect(button).toHaveProperty("disabled", true);
    fireEvent.drop(button, { dataTransfer: { files: [file] } });
    expect(onFiles).not.toHaveBeenCalled();
  });

  test("shows each error in a live region", () => {
    setup({ errors: ["setup.exe isn't a supported file type.", "empty.pdf is empty."] });
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "setup.exe isn't a supported file type.",
      "empty.pdf is empty.",
    ]);
    expect(items[0].closest("[aria-live]")).not.toBeNull();
  });
});
