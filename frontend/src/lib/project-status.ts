import type { ProjectView } from "@/lib/api";

export function statusLabel(status: ProjectView["status"]) {
  if (status === "COMPLETED") return "Completed";
  if (status === "DRAFT") return "Draft";
  return "Active";
}

export function statusClasses(status: ProjectView["status"]) {
  if (status === "ACTIVE") return "bg-[#c9e9b9] text-[#173d18]";
  if (status === "COMPLETED") return "bg-[#d9e8f1] text-[#173d3e]";
  return "bg-[#f3e4c7] text-[#604a25]";
}