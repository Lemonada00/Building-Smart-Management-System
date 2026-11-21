import { z } from "zod";
import { disciplineNames, severityNames } from "@/lib/work-orders/types";

export const draftFields = z.object({
  description: z.string().trim().min(1),
  location: z.string().trim().min(1),
  severity: z.enum(severityNamesKeys()),
  discipline: z.enum(disciplineNamesKeys()),
  details: z.string().trim(),
});

function severityNamesKeys() {
  return Object.keys(severityNames) as Array<keyof typeof severityNames>;
}
function disciplineNamesKeys() {
  return Object.keys(disciplineNames) as Array<keyof typeof disciplineNames>;
}

export const draftAddress = z.object({
  sessionId: z.uuid(),
  draftId: z.uuid(),
});
export const draftVersion = draftAddress.extend({
  expectedRevision: z.number().int().nonnegative(),
});
export const draftForm = draftFields.extend({
  assigneeId: z.uuid().nullable(),
  uploadIds: z.array(z.uuid()).max(9),
  photoIds: z.array(z.uuid()).max(9),
});
export type DraftForm = z.infer<typeof draftForm>;
export type DraftStatus = "editing" | "cancelled" | "expired" | "created";
export type DraftPhotoOption = { id: string; name: string; url: string };
export type DraftCardData = {
  id: string;
  revision: number;
  status: DraftStatus;
  form: DraftForm;
  assignees: Array<{ id: string; name: string }>;
  uploads: DraftPhotoOption[];
  photos: DraftPhotoOption[];
  workOrderNumber?: number;
};
