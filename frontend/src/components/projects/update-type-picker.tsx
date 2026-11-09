import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { updateTypeStyles } from "@/components/projects/update-types";
import type { UpdateType } from "@/api/models";

const updateTypes = Object.keys(updateTypeStyles) as UpdateType[];

interface UpdateTypePickerProps {
  value: UpdateType | null;
  onChange: (type: UpdateType) => void;
  error?: ReactNode;
  errorId?: string;
}

export function UpdateTypePicker({ value, onChange, error, errorId }: UpdateTypePickerProps) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-semibold">Update type <span className="text-primary">*</span></legend>
      <div className="flex flex-wrap gap-3">
        {updateTypes.map((type) => {
          const selected = value === type;
          return (
            <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold text-brand-mahogany focus-within:ring-3 focus-within:ring-ring/50 ${updateTypeStyles[type].className} ${selected ? "border-brand-garnet" : "border-transparent"}`}>
              <input
                type="radio"
                name="update-type"
                value={type}
                checked={selected}
                onChange={() => onChange(type)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="sr-only"
              />
              <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded-full border border-brand-mahogany ${selected ? "bg-brand-garnet text-white" : "bg-white"}`}>
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>
              {updateTypeStyles[type].label}
            </label>
          );
        })}
      </div>
      {error}
    </fieldset>
  );
}
