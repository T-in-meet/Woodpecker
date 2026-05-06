import { ROUTES } from "@/lib/constants/routes";

export type NotesView = "list" | "cards";

export function buildNotesUrl(params: {
  query?: string;
  view?: NotesView;
  page?: number;
}): string {
  const search = new URLSearchParams();
  const q = params.query?.trim();
  if (q) search.set("q", q);
  if (params.view && params.view !== "list") search.set("view", params.view);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return `${ROUTES.NOTES}${qs ? `?${qs}` : ""}`;
}
