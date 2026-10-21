import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: TagInputProps) {
  const [value, setValue] = useState("");
  function addTag() {
    const next = value.trim().toLowerCase();
    if (next && !tags.includes(next) && tags.length < 10) onChange([...tags, next]);
    setValue("");
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
    if (event.key === "Backspace" && !value && tags.length) onChange(tags.slice(0, -1));
  }

  return (
    <div>
      <label htmlFor="project-tags" className="mb-2 block text-sm font-semibold">Tags</label>
      <Input
        id="project-tags"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addTag}
        placeholder="Search or add tag"
        className="h-9 rounded-lg px-3 text-sm"
      />
      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Selected tags">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs">
              {tag}
              <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(tags.filter((item) => item !== tag))}>
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-right text-xs text-muted-foreground">{tags.length}/10</p>
    </div>
  );
}
