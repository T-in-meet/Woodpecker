import { z } from "zod";

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
  next_review_at: z.string().nullable(),
  review_round: z.number().int().min(0).max(MAX_REVIEW_ROUND),
  updated_at: z.string(),
});

export type NoteDetail = z.infer<typeof noteDetailSchema>;
export type NoteSummary = z.infer<typeof noteSummarySchema>;

export async function getNotes(userId: string): Promise<NoteSummary[]> {
  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from("notes")
    .select("id, title, next_review_at, review_round, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const parsed = z.array(noteSummarySchema).safeParse(data);

  return parsed.success ? parsed.data : [];
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
