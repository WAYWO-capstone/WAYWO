import type { ReactNode } from "react";
import { CategorySelector } from "@/components/projects/category-selector";
import { TagInput } from "@/components/projects/tag-input";
import { Input } from "@/components/ui/input";
import type { ProjectInput } from "@/lib/api";
import type { useProjectCategories } from "@/lib/project-form";

interface ProjectFormFieldsProps {
  value: ProjectInput;
  onChange: (value: ProjectInput) => void;
  categories: ReturnType<typeof useProjectCategories>;
  hint: ReactNode;
  // Locks every field while a save is in flight, so edits made meanwhile aren't lost.
  disabled?: boolean;
}

export function ProjectFormFields({ value, onChange, categories, hint, disabled = false }: ProjectFormFieldsProps) {
  const set = <K extends keyof ProjectInput>(field: K, next: ProjectInput[K]) => onChange({ ...value, [field]: next });

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)] lg:gap-14">
      <div className="space-y-6">
        <div>
          <label htmlFor="project-title" className="mb-2 block text-sm font-semibold">Project title <span className="text-primary">*</span></label>
          <Input id="project-title" required maxLength={200} placeholder="Give your project a name" value={value.title} onChange={(event) => set("title", event.target.value)} />
        </div>
        <div>
          <label htmlFor="project-summary" className="mb-2 block text-sm font-semibold">Summary <span className="text-primary">*</span></label>
          <Input id="project-summary" required maxLength={500} placeholder="What are you making?" value={value.summary} onChange={(event) => set("summary", event.target.value)} />
        </div>
        <div>
          <label htmlFor="project-description" className="mb-2 block text-sm font-semibold">Description <span className="text-primary">*</span></label>
          <textarea id="project-description" required value={value.description} onChange={(event) => set("description", event.target.value)} placeholder="Describe your goals, process, and plans..." className="min-h-52 w-full resize-y rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50" />
        </div>
      </div>

      <aside className="h-fit space-y-6 rounded-xl border bg-card p-5">
        {categories.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading categories...</p>
        ) : categories.isError ? (
          <div role="alert" className="text-sm text-destructive">Could not load categories. <button type="button" className="underline" onClick={() => void categories.refetch()}>Try again</button></div>
        ) : (
          <CategorySelector categories={categories.data ?? []} value={value.category_id} onChange={(categoryId) => set("category_id", categoryId)} />
        )}
        <TagInput tags={value.tags} onChange={(tags) => set("tags", tags)} />
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      </aside>
    </fieldset>
  );
}
