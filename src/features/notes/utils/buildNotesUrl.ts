import { ROUTES } from "@/lib/constants/routes";

export type NotesView = "list" | "cards";

export function buildNotesUrl(params: {
  query?: string;
  page?: number;
  view?: NotesView;
}): string {
  const search = new URLSearchParams();
  const q = params.query?.trim();
  if (q) search.set("q", q);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.view === "cards") search.set("view", "cards");
  const qs = search.toString();
  return `${ROUTES.NOTES}${qs ? `?${qs}` : ""}`;
}
