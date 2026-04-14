import { z } from "zod";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { createClient } from "@/lib/supabase/server";

const noteDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  language: z.enum(NOTE_LANGUAGE_VALUES).nullable(),
  next_review_at: z.string().nullable(),
  review_round: z.number().int().min(0).max(MAX_REVIEW_ROUND),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid(),
});

export type NoteDetail = z.infer<typeof noteDetailSchema>;

export async function getNotes() {
  return [];
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<NoteDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select(
      "id, title, content, language, next_review_at, review_round, created_at, updated_at, user_id",
    )
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  const parsed = noteDetailSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
