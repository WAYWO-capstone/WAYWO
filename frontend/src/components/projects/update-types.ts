import type { UpdateType } from "@/api/models";

// Badge for update type (colors in index.css).
export const updateTypeStyles: Record<UpdateType, { label: string; className: string }> = {
  PROGRESS: { label: "Progress", className: "bg-update-progress" },
  DECISION: { label: "Decision", className: "bg-update-decision" },
  PROBLEM: { label: "Problem", className: "bg-update-problem" },
  SOLUTION: { label: "Solution", className: "bg-update-solution" },
};
