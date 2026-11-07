import { X } from "lucide-react";
import { useState } from "react";
import type { ProjectCategory } from "@/api/models";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

interface CategorySelectorProps {
  categories: ProjectCategory[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function CategorySelector({
  categories,
  value,
  onChange,
}: CategorySelectorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const selectedCategory = categories.find((category) => category.id === value);

  return (
    <section aria-labelledby="category-label">
      <label id="category-label" className="mb-2 block text-sm font-semibold">
        Category <span className="text-primary">*</span>
      </label>
      {selectedCategory && (
        <div className="mb-2">
          <button
            type="button"
            title={selectedCategory.description || selectedCategory.name}
            aria-label={`Remove ${selectedCategory.name} category`}
            onClick={() => onChange("")}
            className="flex min-h-8 items-center gap-2 rounded-full bg-brand-garnet px-2.5 text-left text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="size-3 shrink-0 rounded-full border-2 border-white bg-blue-500" />
            <span className="truncate">{selectedCategory.name}</span>
            <X className="ml-auto size-3.5 shrink-0" aria-hidden="true" />
          </button>
        </div>
      )}
      <Combobox
        items={categories}
        value={selectedCategory ?? null}
        inputValue={search}
        open={isOpen}
        modal={false}
        onOpenChange={setIsOpen}
        itemToStringLabel={(category: ProjectCategory) => category.name}
        isItemEqualToValue={(
          category: ProjectCategory,
          selected: ProjectCategory,
        ) => category.id === selected.id}
        onInputValueChange={setSearch}
        onValueChange={(category: ProjectCategory | null) => {
          if (category) {
            onChange(category.id);
            setSearch("");
            setIsOpen(false);
          }
        }}
      >
        <ComboboxInput
          aria-label="Search categories"
          placeholder="Search categories"
          onFocus={() => setIsOpen(true)}
        />
        <ComboboxContent>
          <ComboboxEmpty>No matching categories.</ComboboxEmpty>
          <ComboboxList>
            {(category: ProjectCategory) => (
              <ComboboxItem
                key={category.id}
                value={category}
                title={category.description || category.name}
              >
                <span className="truncate">{category.name}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {categories.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          No categories are available yet.
        </p>
      )}
    </section>
  );
}
