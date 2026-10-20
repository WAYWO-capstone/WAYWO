import { useMutation } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle, Trash2 } from "lucide-react";
import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteProject, type ProjectView } from "@/lib/api";
import { requestError } from "@/lib/project-form";

interface DeleteProjectDialogProps {
  project: Pick<ProjectView, "id" | "title">;
  onDeleted: () => Promise<void> | void;
}

export function DeleteProjectDialog({ project, onDeleted }: DeleteProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const deletion = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: async () => {
      setOpen(false);
      await onDeleted();
    },
  });
  // exact, case-sensitive, ignoring surrounding whitespace
  const nameMatches = confirmation.trim() === project.title.trim();

  function onOpenChange(next: boolean) {
    if (deletion.isPending) return;
    setOpen(next);
    if (!next) {
      setConfirmation("");
      deletion.reset();
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nameMatches) deletion.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<button type="button" className="inline-flex h-11 items-center gap-2 rounded-md border border-[#ead7c7] bg-[#fbf0e4] px-4 text-sm font-semibold text-brand-garnet hover:bg-[#f6e4d2] focus-visible:ring-3 focus-visible:ring-ring/50" />}>
        <Trash2 className="size-4" aria-hidden="true" />Delete
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-0 rounded-2xl bg-background p-6 text-foreground sm:max-w-lg sm:p-8">
        <DialogTitle className="text-3xl font-bold tracking-tight">Delete project</DialogTitle>
        <form onSubmit={submit} className="mt-6">
          <DialogDescription className="text-base font-semibold text-foreground">
            Are you sure you want to delete this project? This action is permanent. Enter the name of your project to confirm.
          </DialogDescription>
          <p className="mt-3 text-sm text-muted-foreground">
            Project name: <span className="font-semibold text-foreground">{project.title}</span>
          </p>
          <Input
            aria-label="Name of project"
            placeholder="Name of project"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={deletion.isPending}
            className="mt-3"
          />
          {deletion.isError && (
            <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" />{requestError(deletion.error)}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <DialogClose render={<Button type="button" variant="ghost" disabled={deletion.isPending} className="h-10 bg-border px-6 font-semibold hover:bg-input" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!nameMatches || deletion.isPending} className="h-10 bg-brand-rust px-6 font-semibold text-white hover:bg-brand-rust/80">
              {deletion.isPending ? <><LoaderCircle className="size-4 animate-spin" />Deleting...</> : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
