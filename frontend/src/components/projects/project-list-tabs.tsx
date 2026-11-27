import { Archive, FolderOpen, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ProjectList = "published" | "drafts" | "archived";

interface ProjectListTabsProps {
  list: ProjectList;
  onSelect: (list: ProjectList) => void;
}

export function ProjectListTabs({ list, onSelect }: ProjectListTabsProps) {
  return (
    <div role="group" aria-label="Choose projects to view" className="mt-8 flex flex-wrap gap-4">
      <Button type="button" variant={list === "published" ? "default" : "outline"} aria-pressed={list === "published"} className="h-12 px-5" onClick={() => onSelect("published")}>
        <Globe2 aria-hidden="true" /> Published projects
      </Button>
      <Button type="button" variant={list === "drafts" ? "default" : "outline"} aria-pressed={list === "drafts"} className="h-12 px-5" onClick={() => onSelect("drafts")}>
        <FolderOpen aria-hidden="true" /> Draft projects
      </Button>
      <Button type="button" variant={list === "archived" ? "default" : "outline"} aria-pressed={list === "archived"} className="h-12 px-5" onClick={() => onSelect("archived")}>
        <Archive aria-hidden="true" /> Archived projects
      </Button>
    </div>
  );
}
