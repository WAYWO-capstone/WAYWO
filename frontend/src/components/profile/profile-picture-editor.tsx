import { LoaderCircle, Pencil } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ApiError } from "@/api/client";
import { useUpdateProfilePicture } from "@/lib/profile-editing";

export function ProfilePictureEditor({
  username,
  src,
}: {
  username: string;
  src: string | null;
}) {
  const savePicture = useUpdateProfilePicture();
  const inputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];

    // allow choosing the same file again after an error
    event.currentTarget.value = "";
    if (!file || savePicture.isPending) return;

    savePicture.reset();
    setFileError(null);

    if (file.size > 5 * 1024 * 1024) {
      setFileError("Choose an image that is 5 MB or smaller.");
      return;
    }

    if (file.size === 0 || (file.type && !file.type.startsWith("image/"))) {
      setFileError("Please choose an image file.");
      return;
    }

    savePicture.mutate(file, {
      onSettled: () => {
        requestAnimationFrame(() => editButtonRef.current?.focus());
      },
    });
  }

  const status =
    savePicture.error instanceof ApiError
      ? savePicture.error.status
      : null;

  const errorMessage =
    fileError ??
    (savePicture.isError
      ? status === 401
        ? "Please log out and log in again before saving."
        : status === 413
          ? "Choose an image that is 5 MB or smaller."
          : status === 400
            ? "This image could not be used. Please choose another image."
            : "Your picture could not be saved. Please try again."
      : null);

  return (
    <div aria-busy={savePicture.isPending} className="max-w-40 shrink-0">
      <div className="relative w-fit">
        <ProfileAvatar
          username={username}
          src={src}
          className="size-20 text-xl"
        />

        <button
          ref={editButtonRef}
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={savePicture.isPending}
          aria-label="Edit profile picture"
          title="Change profile picture"
          className="absolute right-0 bottom-0 flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-brand-garnet text-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
        >
          {savePicture.isPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin"
            />
          ) : (
            <Pencil aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Choose profile picture"
        onChange={handleFileChange}
        disabled={savePicture.isPending}
        hidden
      />

      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {errorMessage}
        </p>
      )}

      {savePicture.isPending && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Uploading…
        </p>
      )}

      {savePicture.isSuccess && !fileError && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Picture saved
        </p>
      )}
    </div>
  );
}
