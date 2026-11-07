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
      <Combobox
        items={categories}
        value={selectedCategory ?? null}
        inputValue={isOpen ? search : selectedCategory?.name ?? search}
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
          onFocus={() => {
            setSearch("");
            setIsOpen(true);
          }}
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
