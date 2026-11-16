import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type {
  ProjectUpdate,
  UpdateReferenceCreate,
  UpdateReferenceRead,
  UpdateReferenceReason,
  UpdateType,
} from "@/api/models";
import { getAllProjectUpdates } from "@/api/updates";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { updateTypeStyles } from "@/components/projects/update-types";
import { Button } from "@/components/ui/button";

const REFERENCE_LIMIT = 50;

const referenceReasons = [
  { value: "RELATED_TO", label: "Related to" },
  { value: "SOLVES", label: "Solves" },
  { value: "PARTIALLY_SOLVES", label: "Partially solves" },
] as const satisfies readonly {
  value: UpdateReferenceReason;
  label: string;
}[];

interface UpdateReferenceEditorProps {
  projectId: string;
  updateId?: string;
  updateType: UpdateType | null;
  references: UpdateReferenceCreate[];
  incomingReferences?: UpdateReferenceRead[];
  onChange: (references: UpdateReferenceCreate[]) => void;
}

export function UpdateReferenceEditor({
  projectId,
  updateId,
  updateType,
  references,
  incomingReferences = [],
  onChange,
}: UpdateReferenceEditorProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const updatesQuery = useQuery({
    queryKey: ["project-updates-for-references", projectId],
    queryFn: () => getAllProjectUpdates(projectId),
  });
  const updates = updatesQuery.data ?? [];
  const selectedIds = new Set(references.map((reference) => reference.target_update_id));
  const availableUpdates = updates.filter((update) => {
    if (update.id === updateId || selectedIds.has(update.id)) return false;
    return !update.outgoing_references?.some(
      (reference) => reference.linked_update_id === updateId,
    );
  });
  const updateById = new Map(updates.map((update) => [update.id, update]));

  function addReference(update: ProjectUpdate | null) {
    if (
      !update ||
      selectedIds.has(update.id) ||
      references.length >= REFERENCE_LIMIT
    ) {
      return;
    }

    onChange([
      ...references,
      { target_update_id: update.id, reason: "RELATED_TO" },
    ]);
    setSearch("");
    setIsOpen(false);
  }

  return (
    <section
      aria-labelledby="linked-updates-heading"
      className="border-t border-border pt-5"
    >
      <h2 id="linked-updates-heading" className="mb-1 text-sm font-semibold">
        Linked updates
      </h2>
      <p className="mb-3 text-xs leading-5 text-muted-foreground">
        Optionally connect this update to other updates in the project.
      </p>

      {references.length > 0 && (
        <>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Links from this update
          </h3>
          <ul className="mb-3 space-y-2">
            {references.map((reference) => {
              const target = updateById.get(reference.target_update_id);
              const canUseSolveReason =
                updateType === "SOLUTION" && target?.type === "PROBLEM";
              const reasonIsValid =
                reference.reason === "RELATED_TO" || canUseSolveReason;
              const title = target?.title ?? "Update unavailable";

              return (
                <li
                  key={reference.target_update_id}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                      {target && (
                        <div className="mt-1">
                          <UpdateTypeTag type={target.type} />
                        </div>
                      )}
                    {!reasonIsValid && (
                      <p className="mt-1 text-xs text-destructive">
                        Solve relationships require a Solution linked to a Problem.
                      </p>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span className="sr-only">
                      Relationship to {title}
                    </span>
                    <select
                      aria-label={`Relationship to ${title}`}
                      value={reference.reason}
                      onChange={(event) => {
                        const reason = event.target.value as UpdateReferenceCreate["reason"];
                        onChange(
                          references.map((item) =>
                            item.target_update_id === reference.target_update_id
                              ? { ...item, reason }
                              : item,
                          ),
                        );
                      }}
                      className="min-h-9 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {referenceReasons.map((reason) => {
                        const isSolveReason = reason.value !== "RELATED_TO";
                        return (
                          <option
                            key={reason.value}
                            value={reason.value}
                            disabled={isSolveReason && !canUseSolveReason}
                          >
                            {reason.label}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove link to ${title}`}
                    onClick={() =>
                      onChange(
                        references.filter(
                          (item) =>
                            item.target_update_id !== reference.target_update_id,
                        ),
                      )
                    }
                    className="self-end sm:self-auto"
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {incomingReferences.length > 0 && (
        <div className="mb-3">
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
            Links to this update
          </h3>
          <ul className="space-y-2">
            {incomingReferences.map((reference) => (
              <li
                key={reference.linked_update_id}
                className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{reference.title}</p>
                  <div className="mt-1">
                    <UpdateTypeTag type={reference.type} />
                  </div>
                </div>
                <span className="text-xs font-medium text-brand-mahogany">
                  {incomingReasonLabels[reference.reason]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Combobox
        items={availableUpdates}
        value={null}
        inputValue={isOpen ? search : ""}
        open={isOpen}
        modal={false}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setSearch("");
        }}
        itemToStringLabel={(update: ProjectUpdate) => update.title}
        isItemEqualToValue={(update: ProjectUpdate, selected: ProjectUpdate) =>
          update.id === selected.id
        }
        onInputValueChange={setSearch}
        onValueChange={addReference}
      >
        <ComboboxInput
          aria-label="Search updates to link"
          placeholder={
            references.length >= REFERENCE_LIMIT
              ? "Reference limit reached"
              : "Search updates to link"
          }
          disabled={
            references.length >= REFERENCE_LIMIT || updatesQuery.isLoading
          }
          onFocus={() => setIsOpen(true)}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {updates.length === 0
              ? "No other updates are available yet."
              : "No matching updates."}
          </ComboboxEmpty>
          <ComboboxList>
            {(update: ProjectUpdate) => (
              <ComboboxItem key={update.id} value={update}>
                <span className="min-w-0 flex-1 truncate">{update.title}</span>
                <UpdateTypeTag type={update.type} />
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {updatesQuery.isLoading && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Loading project updates...
        </p>
      )}
      {updatesQuery.isError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          Could not load updates to link. Try again later.
        </p>
      )}
      {!updatesQuery.isLoading &&
        !updatesQuery.isError &&
        availableUpdates.length === 0 &&
        updates.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No other eligible updates are available to link.
          </p>
        )}
      {references.length >= REFERENCE_LIMIT && (
        <p className="mt-2 text-xs text-muted-foreground">
          An update can link to at most {REFERENCE_LIMIT} updates.
        </p>
      )}
    </section>
  );
}

function UpdateTypeTag({ type }: { type: UpdateType }) {
  const style = updateTypeStyles[type];
  return (
    <span className={`inline-flex w-fit rounded-[7px] px-2 py-0.5 text-xs font-semibold text-brand-mahogany ${style.className}`}>
      {style.label}
    </span>
  );
}

const incomingReasonLabels: Record<UpdateReferenceRead["reason"], string> = {
  SOLVES: "Solves",
  SOLVED_BY: "Solved by",
  PARTIALLY_SOLVES: "Partially solves",
  PARTIALLY_SOLVED_BY: "Partially solved by",
  RELATED_TO: "Related to",
};
