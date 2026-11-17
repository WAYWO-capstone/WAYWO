import type {
  UpdateReferenceRead,
  UpdateReferenceReason,
} from "@/api/models";

export const updateReferenceReasonLabels: Record<
  UpdateReferenceRead["reason"],
  string
> = {
  SOLVES: "Solves",
  PARTIALLY_SOLVES: "Partially solves",
  RELATED_TO: "Related to",
  SOLVED_BY: "Solved by",
  PARTIALLY_SOLVED_BY: "Partially solved by",
};

const editableReasons: Record<UpdateReferenceReason, true> = {
  RELATED_TO: true,
  SOLVES: true,
  PARTIALLY_SOLVES: true,
};

export const updateReferenceReasonOptions = (
  Object.keys(editableReasons) as UpdateReferenceReason[]
).map((value) => ({
  value,
  label: updateReferenceReasonLabels[value],
}));
