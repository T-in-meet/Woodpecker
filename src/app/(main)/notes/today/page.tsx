import { redirect } from "next/navigation";

import { buildNotesUrl } from "@/features/notes/utils/buildNotesUrl";

export default function TodayReviewPage() {
  redirect(buildNotesUrl({ view: "due" }));
}
