import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ProjectUpdate } from "@/api/models";
import { deleteProjectUpdate } from "@/api/updates";
import { updateRequestError } from "@/lib/update-form";

export function DeleteUpdateDialog({ update }: { update: Pick<ProjectUpdate, "id" | "project_id" | "title"> }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const deletion = useMutation({
    mutationFn: () => deleteProjectUpdate(update.project_id, update.id),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["project-history", update.project_id] });
    },
  });

  function onOpenChange(next: boolean) {
    if (deletion.isPending) return;
    setOpen(next);
    if (!next) deletion.reset();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" className="h-8 rounded-lg border-destructive px-4 font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive" />}>
        Delete
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-0 rounded-2xl bg-background p-6 text-foreground sm:max-w-lg sm:p-8">
        <DialogTitle className="text-3xl font-bold tracking-tight">Delete update</DialogTitle>
        <DialogDescription className="mt-6 text-base font-semibold text-foreground">
          Are you sure you want to delete this update? This action is permanent.
        </DialogDescription>
        <p className="mt-3 text-sm text-muted-foreground">
          Update: <span className="font-semibold text-foreground">{update.title}</span>
        </p>
        {deletion.isError && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" />{updateRequestError(deletion.error)}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <DialogClose render={<Button type="button" variant="ghost" disabled={deletion.isPending} className="h-10 bg-border px-6 font-semibold hover:bg-input" />}>
            Cancel
          </DialogClose>
          <Button type="button" onClick={() => deletion.mutate()} disabled={deletion.isPending} className="h-10 bg-brand-rust px-6 font-semibold text-white hover:bg-brand-rust/80">
            {deletion.isPending ? <><LoaderCircle className="size-4 animate-spin" />Deleting...</> : "Delete update"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
