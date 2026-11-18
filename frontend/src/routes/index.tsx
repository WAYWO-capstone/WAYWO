import { createFileRoute, redirect } from "@tanstack/react-router";

// The home page lives at /home, so send visitors of / there.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/home", replace: true });
  },
});
