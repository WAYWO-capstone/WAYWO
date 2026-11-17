import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { requestError } from "@/lib/project-form";

interface ProjectDiscardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  deletesDraft: boolean;
  destination: string;
}

export function ProjectDiscardDialog({ open, onOpenChange, onConfirm, deletesDraft, destination }: ProjectDiscardDialogProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  function changeOpen(next: boolean) {
    if (working) return;
    if (next) setError("");
    onOpenChange(next);
  }

  async function confirm() {
    setWorking(true);
    setError("");
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      setError(requestError(cause instanceof Error ? cause : new Error("Request failed")));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-0 rounded-2xl p-6 sm:max-w-lg sm:p-8">
        <DialogTitle className="text-2xl font-bold">Discard project changes?</DialogTitle>
        <DialogDescription className="mt-3 text-base">
          {deletesDraft
            ? "Your changes will be discarded and your autosaved draft will be deleted. This action cannot be undone."
            : `Your unsaved changes will be discarded and you will return to ${destination}.`}
        </DialogDescription>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <DialogClose render={<Button type="button" variant="ghost" disabled={working}>Keep editing</Button>} />
          <Button type="button" variant="destructive" disabled={working} onClick={() => void confirm()}>
            {working ? <><LoaderCircle className="size-4 animate-spin" />Discarding...</> : "Discard changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
