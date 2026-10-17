import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <section className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      <div className="mt-8 flex flex-wrap gap-4">
        <Button type="button" variant="outline" className="h-12 px-5" disabled>
          <Globe2 aria-hidden="true" /> Published projects
        </Button>
        <Button type="button" variant="outline" className="h-12 px-5" disabled>
          <FolderOpen aria-hidden="true" /> Draft projects
        </Button>
      </div>
    </section>
  );
}
