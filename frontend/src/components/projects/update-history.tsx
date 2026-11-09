import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleAlert, LoaderCircle, Plus } from "lucide-react";
import { getProjectHistory } from "@/api/updates";
import type { ProjectUpdate } from "@/api/models";
import { UpdateTimeline } from "@/components/projects/update-item";

interface UpdateHistoryProps {
  // When there is no projectId (sample preview), these updates are shown instead.
  projectId?: string;
  previewUpdates?: ProjectUpdate[];
  canManage?: boolean;
}

export function UpdateHistory({ projectId, previewUpdates = [], canManage = false }: UpdateHistoryProps) {
  const historyQuery = useInfiniteQuery({
    queryKey: ["project-history", projectId],
    queryFn: ({ pageParam }) => getProjectHistory(projectId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.offset + lastPage.items.length;
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: Boolean(projectId),
  });

  const updates = projectId
    ? (historyQuery.data?.pages.flatMap((page) => page.items) ?? [])
    : previewUpdates;

  return (
    <section aria-labelledby="updates-heading" className="flex max-h-180 min-h-105 flex-col rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="updates-heading" className="text-lg font-bold text-brand-mahogany">Updates</h2>
        {projectId && canManage && (
          <Link to="/add-update" search={{ projectId }} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50">
            <Plus className="size-4" aria-hidden="true" />Add update
          </Link>
        )}
      </div>

      <div tabIndex={0} aria-label="Project updates" className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring">
        {projectId && historyQuery.isLoading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading updates...
          </p>
        ) : projectId && historyQuery.isError ? (
          <p role="alert" className="flex items-center gap-2 py-10 text-sm text-destructive">
            <CircleAlert className="size-4" aria-hidden="true" />Could not load updates. Try again later.
          </p>
        ) : updates.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <UpdateTimeline updates={updates} canManage={canManage} />
        )}
        {historyQuery.hasNextPage && (
          <button
            type="button"
            onClick={() => historyQuery.fetchNextPage()}
            disabled={historyQuery.isFetchingNextPage}
            className="mt-2 ml-8 flex items-center gap-2 text-base font-semibold text-brand-garnet underline underline-offset-4 hover:text-brand-rust disabled:opacity-60"
          >
            {historyQuery.isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            Load more updates
          </button>
        )}
      </div>
    </section>
  );
}
