import type { UploadKindConfig } from "@/lib/uploads/api-types";

export const MAX_FILES_PER_SELECTION = 10;

// Lowercased extension with its dot (similar to backend).
// Returns "" for names with no dot, or whose only dot is the first character (".env").
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

function formatMegabytes(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

// Returns why the file can't be uploaded, or null when it can.
export function validateFile(file: File, rules: UploadKindConfig): string | null {
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > rules.max_size) {
    return `${file.name} is larger than ${formatMegabytes(rules.max_size)}.`;
  }
  // Adding file type if there is one included, else only based on extension
  const typeAllowed = file.type !== "" && rules.allowed_mime.includes(file.type);
  const extensionAllowed = rules.allowed_extensions.includes(fileExtension(file.name));
  if (!typeAllowed && !extensionAllowed) return `${file.name} isn't a supported file type.`;
  return null;
}

export interface SplitFiles {
  valid: File[];
  errors: string[];
}

//handle multi file selection and add guard
export function splitFiles(files: Iterable<File>, rules: UploadKindConfig): SplitFiles {
  const selected = Array.from(files);
  if (selected.length > MAX_FILES_PER_SELECTION) {
    return {
      valid: [],
      errors: [`You can add up to ${MAX_FILES_PER_SELECTION} files at a time.`],
    };
  }

  const valid: File[] = [];
  const errors: string[] = [];
  for (const file of selected) {
    const error = validateFile(file, rules);
    if (error) errors.push(error);
    else valid.push(file);
  }
  return { valid, errors };
}

// Value for the file input's `accept`, listing types and extensions.
export function acceptFor(rules: UploadKindConfig): string {
  return [...rules.allowed_mime, ...rules.allowed_extensions].join(",");
}
