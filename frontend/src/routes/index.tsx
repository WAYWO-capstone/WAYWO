import { createFileRoute, redirect } from "@tanstack/react-router";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: isAuthenticated() ? "/home" : "/explore",
      replace: true,
    });
  },
});
