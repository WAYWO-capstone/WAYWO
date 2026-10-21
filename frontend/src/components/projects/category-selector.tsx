import { Info } from "lucide-react";
import { useState } from "react";
import type { ProjectCategory } from "@/lib/api";
import { Input } from "@/components/ui/input";

interface CategorySelectorProps {
  categories: ProjectCategory[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function CategorySelector({ categories, value, onChange }: CategorySelectorProps) {
  const [search, setSearch] = useState("");
  const filtered = categories.filter((category) =>
    category.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <section aria-labelledby="category-label">
      <label id="category-label" className="mb-2 block text-sm font-semibold">
        Category <span className="text-primary">*</span>
      </label>
      <div className="mb-2 grid grid-cols-2 gap-2">
        {filtered.map((category) => {
          const selected = value === category.id;
          return (
            <button
              key={category.id}
              type="button"
              title={category.description || category.name}
              aria-pressed={selected}
              onClick={() => onChange(category.id)}
              className="flex min-h-8 items-center gap-2 rounded-full bg-brand-garnet px-2.5 text-left text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={`size-3 shrink-0 rounded-full border-2 border-white ${selected ? "bg-blue-500" : "bg-white"}`} />
              <span className="truncate">{category.name}</span>
              <Info className="ml-auto size-3.5 shrink-0" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <Input
        aria-label="Search categories"
        placeholder="Search categories"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-9 rounded-lg px-3 text-sm"
      />
      {filtered.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {search ? "No matching categories." : "No categories are available yet."}
        </p>
      )}
    </section>
  );
}
