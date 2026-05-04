import { z } from "zod";

import { NOTES_LIST_PAGE_SIZE } from "@/lib/constants/notes";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { createServerComponentClient } from "@/lib/supabase/server";

const noteDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  next_review_at: z.string().nullable(),
  notification_time_of_day: z.string().nullable(),
  review_round: z.number().int().min(0).max(MAX_REVIEW_ROUND),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid(),
});

const noteSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  next_review_at: z.string().nullable(),
  review_round: z.number().int().min(0).max(MAX_REVIEW_ROUND),
  created_at: z.string(),
  updated_at: z.string(),
});

export type NoteDetail = z.infer<typeof noteDetailSchema>;
export type NoteSummary = z.infer<typeof noteSummarySchema>;

export async function getNotes(
  userId: string,
  page = 1,
  search = "",
  pageSize = NOTES_LIST_PAGE_SIZE,
): Promise<{ notes: NoteSummary[]; total: number }> {
  const supabase = await createServerComponentClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notes")
    .select(
      "id, title, content, next_review_at, review_round, created_at, updated_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (search.trim()) {
    const term = search
      .trim()
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_");
    query = query.or(`title.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const { data, count } = await query.range(from, to);

  const parsed = z.array(noteSummarySchema).safeParse(data);

  if (!parsed.success) {
    console.error("[getNotes] noteSummarySchema 파싱 실패:", parsed.error);
  }

  return { notes: parsed.success ? parsed.data : [], total: count ?? 0 };
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<NoteDetail | null> {
  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from("notes")
    .select(
      "id, title, content, next_review_at, notification_time_of_day, review_round, created_at, updated_at, user_id",
    )
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  const parsed = noteDetailSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
