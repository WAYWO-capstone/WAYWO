import { createFileRoute, redirect } from "@tanstack/react-router";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { isAuthenticated } from "@/lib/token-store";

export const Route = createFileRoute("/create-project")({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login", search: { redirect: "/create-project" } });
    }
  },
  component: CreateProjectPage,
});

function CreateProjectPage() {
  return <CreateProjectForm />;
}
