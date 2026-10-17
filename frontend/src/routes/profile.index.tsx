import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profile/")({
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
      <h1 className="text-3xl font-bold">Profile page</h1>
    </div>
  );
}