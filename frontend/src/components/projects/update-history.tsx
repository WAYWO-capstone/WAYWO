import type { ProjectUpdate, UpdateType } from "@/api/models";
import { getProjectHistory } from "@/api/updates";
import { UpdateTimeline } from "@/components/projects/update-item";
import { scrollToUpdateInHistory } from "@/components/projects/update-history-scroll";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  CircleAlert,
  Filter,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { updateTypeStyles } from "./update-types";

interface UpdateHistoryProps {
  // When there is no projectId (sample preview), these updates are shown instead.
  projectId?: string;
  targetUpdateId?: string;
  previewUpdates?: ProjectUpdate[];
  canManage?: boolean;
}

export function UpdateHistory({
  projectId,
  targetUpdateId,
  previewUpdates = [],
  canManage = false,
}: UpdateHistoryProps) {
  const [sortOption, setSortOption] = useState<UpdateHistorySortOptions>(
    UpdateHistorySortOptions.DATE_DESC,
  );
  const [resolvedTarget, setResolvedTarget] = useState<{
    projectId?: string;
    updateId: string;
  }>();
  const [filterState, setFilterState] = useState({
    targetUpdateId,
    options: [] as UpdateType[],
  });
  const filterOptions =
    filterState.targetUpdateId === targetUpdateId ? filterState.options : [];

  const historyQuery = useInfiniteQuery({
    queryKey: ["project-history", projectId, filterOptions, sortOption],
    queryFn: ({ pageParam }) =>
      getProjectHistory(
        projectId!,
        pageParam,
        filterOptions.length > 0 ? filterOptions : undefined,
        sortOption,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.offset + lastPage.items.length;
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: Boolean(projectId),
  });
  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isError,
  } = historyQuery;
  const hasLoadedHistory = Boolean(historyQuery.data);

  const updates = projectId
    ? (historyQuery.data?.pages.flatMap((page) => page.items) ?? [])
    : previewUpdates;
  const targetIsLoaded = Boolean(
    targetUpdateId && updates.some((update) => update.id === targetUpdateId),
  );
  const targetSearchResolved = Boolean(
    targetUpdateId &&
      resolvedTarget?.projectId === projectId &&
      resolvedTarget?.updateId === targetUpdateId,
  );
  const isFindingTarget = Boolean(
    targetUpdateId &&
      !targetIsLoaded &&
      !targetSearchResolved &&
      (isLoading || (hasLoadedHistory && hasNextPage)),
  );
  const markTargetResolved = () => {
    if (!targetUpdateId || !targetIsLoaded) return;
    setResolvedTarget((current) =>
      current &&
      current.projectId === projectId &&
      current.updateId === targetUpdateId
        ? current
        : { projectId, updateId: targetUpdateId },
    );
  };
  const setFilterOptions = (options: UpdateType[]) => {
    markTargetResolved();
    setFilterState({ targetUpdateId, options });
  };
  const setSortOptions = (option: UpdateHistorySortOptions) => {
    markTargetResolved();
    setSortOption(option);
  };
  const retryFindingLinkedUpdate = () => {
    void fetchNextPage();
  };

  useEffect(() => {
    if (
      !targetUpdateId ||
      targetIsLoaded ||
      targetSearchResolved ||
      !hasNextPage ||
      isFetchingNextPage ||
      isFetchNextPageError
    ) {
      return;
    }

    void fetchNextPage();
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    targetIsLoaded,
    targetSearchResolved,
    targetUpdateId,
  ]);

  useEffect(() => {
    if (!targetUpdateId || !targetIsLoaded) return;
    return scrollToUpdateInHistory(targetUpdateId);
  }, [targetIsLoaded, targetUpdateId]);

  return (
    <section
      aria-labelledby="updates-heading"
      className="flex max-h-180 min-h-105 flex-col rounded-lg border border-border bg-background p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="updates-heading"
          className="text-lg font-bold text-brand-mahogany"
        >
          Updates
        </h2>
        <div className="flex flex-row gap-2">
          <UpdateHistoryFilter
            value={filterOptions}
            onChange={setFilterOptions}
            disabled={isFindingTarget}
          />
          <UpdateHistorySort value={sortOption} onChange={setSortOptions} />
          {projectId && canManage && (
            <Link
              to="/add-update"
              search={{ projectId }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add update
            </Link>
          )}
        </div>
      </div>

      <div
        tabIndex={0}
        aria-label="Project updates"
        data-update-history-scroll-container
        className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {projectId && isLoading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Loading updates...
          </p>
        ) : projectId && isError && !hasLoadedHistory ? (
          <p
            role="alert"
            className="flex items-center gap-2 py-10 text-sm text-destructive"
          >
            <CircleAlert className="size-4" aria-hidden="true" />
            Could not load updates. Try again later.
          </p>
        ) : updates.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">
            No updates were found.
            {filterOptions.length > 0 && " Try adjusting your filters."}
          </p>
        ) : (
          <UpdateTimeline
            updates={updates}
            projectId={projectId}
            canManage={canManage}
          />
        )}
        {targetUpdateId &&
          !targetIsLoaded &&
          !targetSearchResolved &&
          !isLoading &&
          (!isError || hasLoadedHistory) &&
          (isFetchNextPageError ? (
            <p role="alert" className="mt-3 ml-8 text-sm text-destructive">
              Could not find the linked update.{" "}
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={retryFindingLinkedUpdate}
              >
                Try again
              </button>
            </p>
          ) : hasNextPage ? (
            <p role="status" className="mt-3 ml-8 text-sm text-muted-foreground">
              Finding linked update...
            </p>
          ) : (
            <p role="alert" className="mt-3 ml-8 text-sm text-destructive">
              The linked update could not be found in this project.
            </p>
          ))}
        {hasNextPage &&
          (!targetUpdateId || targetIsLoaded || targetSearchResolved) && (
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="mt-2 ml-8 flex items-center gap-2 text-base font-semibold text-brand-garnet underline underline-offset-4 hover:text-brand-rust disabled:opacity-60"
          >
            {isFetchingNextPage && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Load more updates
          </button>
        )}
      </div>
    </section>
  );
}

export const UpdateHistorySortOptions = {
  DATE_ASC: "date_asc",
  DATE_DESC: "date_desc",
} as const;
export type UpdateHistorySortOptions =
  (typeof UpdateHistorySortOptions)[keyof typeof UpdateHistorySortOptions];

function UpdateHistorySort(props: {
  value: UpdateHistorySortOptions;
  onChange: (value: UpdateHistorySortOptions) => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size={"icon-lg"} />}
        >
          <ArrowUpDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={"min-w-48"}>
          <DropdownMenuRadioGroup
            defaultValue={props.value}
            value={props.value}
            onValueChange={props.onChange}
          >
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {Object.entries(UpdateHistorySortOptions).map((option) => {
              const key = option[0];
              const value = option[1];
              return (
                <DropdownMenuRadioItem key={key} value={value}>
                  {key === "DATE_ASC"
                    ? "Date (Ascending)"
                    : "Date (Descending)"}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function UpdateHistoryFilter(props: {
  value: UpdateType[];
  onChange: (value: UpdateType[]) => void;
  disabled?: boolean;
}) {
  const selectedTypes = props.value;
  const handleTypeChange = (type: UpdateType | "none") => {
    if (type === "none") {
      props.onChange([]);
      return;
    }

    const newSelectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    props.onChange(newSelectedTypes);
  };

  const updateTypes = Object.keys(updateTypeStyles) as UpdateType[];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size={"icon-lg"}
              className="relative"
              aria-label="Filter updates by type"
              disabled={props.disabled}
            />
          }
        >
          <Filter />
          {selectedTypes.length > 0 && (
            <span
              aria-label="Filter active"
              className="absolute top-1 right-1 size-2 rounded-full bg-blue-500"
            />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              key={"none"}
              onClick={() => handleTypeChange("none")}
              checked={selectedTypes.length === 0}
              className={"m-1"}
            >
              No filter
            </DropdownMenuCheckboxItem>
            {updateTypes.map((type: UpdateType) => {
              return (
                <DropdownMenuCheckboxItem
                  className={cn(
                    updateTypeStyles[type].className,
                    `focus:${updateTypeStyles[type].className}`,
                    "m-1",
                  )}
                  key={type}
                  checked={selectedTypes.includes(type)}
                  onCheckedChange={() => handleTypeChange(type)}
                >
                  {updateTypeStyles[type].label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
