import { describe, expect, test } from "vitest";
import type { UploadKindConfig } from "../src/lib/uploads/api-types";
import {
  acceptFor,
  fileExtension,
  MAX_FILES_PER_SELECTION,
  splitFiles,
  validateFile,
} from "../src/lib/uploads/validate";

const MB = 1024 * 1024;

const rules: UploadKindConfig = {
  max_size: 50 * MB,
  allowed_mime: ["application/pdf", "image/png"],
  allowed_extensions: [".stl", ".md"],
};

function makeFile(name: string, size: number, type = ""): File {
  const file = new File([], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("fileExtension", () => {
  test("lowercases the extension and keeps the dot", () => {
    expect(fileExtension("Bracket.STL")).toBe(".stl");
  });

  test("uses the last extension", () => {
    expect(fileExtension("parts.tar.gz")).toBe(".gz");
  });

  test("is empty without an extension", () => {
    expect(fileExtension("README")).toBe("");
    expect(fileExtension(".env")).toBe("");
  });
});

describe("validateFile", () => {
  test("accepts an allowed type", () => {
    expect(validateFile(makeFile("plan.pdf", MB, "application/pdf"), rules)).toBeNull();
  });

  test("accepts an .STL with no type by its extension", () => {
    expect(validateFile(makeFile("Bracket.STL", MB), rules)).toBeNull();
  });

  test("accepts an allowed extension when the type isn't listed", () => {
    expect(validateFile(makeFile("notes.md", MB, "text/markdown"), rules)).toBeNull();
  });

  test("rejects an empty file", () => {
    expect(validateFile(makeFile("plan.pdf", 0, "application/pdf"), rules)).toBe("plan.pdf is empty.");
  });

  test("rejects a file over the size limit", () => {
    expect(validateFile(makeFile("big.pdf", 50 * MB + 1, "application/pdf"), rules)).toBe(
      "big.pdf is larger than 50 MB.",
    );
  });

  test("accepts a file exactly at the size limit", () => {
    expect(validateFile(makeFile("max.pdf", 50 * MB, "application/pdf"), rules)).toBeNull();
  });

  test("rejects a file whose type and extension are both not allowed", () => {
    expect(validateFile(makeFile("setup.exe", MB, "application/x-msdownload"), rules)).toBe(
      "setup.exe isn't a supported file type.",
    );
  });
});

describe("splitFiles", () => {
  test("separates valid files from rejected ones, one message each", () => {
    const pdf = makeFile("plan.pdf", MB, "application/pdf");
    const stl = makeFile("Bracket.STL", MB);
    const result = splitFiles(
      [pdf, makeFile("empty.pdf", 0, "application/pdf"), stl, makeFile("setup.exe", MB)],
      rules,
    );
    expect(result.valid).toEqual([pdf, stl]);
    expect(result.errors).toEqual(["empty.pdf is empty.", "setup.exe isn't a supported file type."]);
  });

  test(`allows ${MAX_FILES_PER_SELECTION} files`, () => {
    const files = Array.from({ length: MAX_FILES_PER_SELECTION }, (_, i) => makeFile(`${i}.stl`, MB));
    expect(splitFiles(files, rules).valid).toHaveLength(MAX_FILES_PER_SELECTION);
  });

  test(`rejects the whole selection above ${MAX_FILES_PER_SELECTION} files`, () => {
    const files = Array.from({ length: MAX_FILES_PER_SELECTION + 1 }, (_, i) => makeFile(`${i}.stl`, MB));
    expect(splitFiles(files, rules)).toEqual({
      valid: [],
      errors: [`You can add up to ${MAX_FILES_PER_SELECTION} files at a time.`],
    });
  });
});

describe("acceptFor", () => {
  test("lists types and extensions", () => {
    expect(acceptFor(rules)).toBe("application/pdf,image/png,.stl,.md");
  });
});
