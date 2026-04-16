import { z } from "zod";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { createClient } from "@/lib/supabase/server";

const reviewableNoteSchema = z.object({
  title: z.string(),
  language: z.enum(NOTE_LANGUAGE_VALUES).nullable(),
  next_review_at: z.string().nullable(),
  review_round: z.number().int().min(0).max(MAX_REVIEW_ROUND),
});

const pendingReviewLogSchema = z.object({
  id: z.string().uuid(),
  note_id: z.string().uuid(),
  round: z.number().int().min(1).max(MAX_REVIEW_ROUND),
  scheduled_at: z.string(),
  completed_at: z.string().nullable(),
});

const noteContentForComparisonSchema = z.object({
  content: z.string(),
  language: z.enum(NOTE_LANGUAGE_VALUES).nullable(),
});

export type ReviewableNote = z.infer<typeof reviewableNoteSchema>;
export type PendingReviewLog = z.infer<typeof pendingReviewLogSchema>;
export type NoteContentForComparison = z.infer<
  typeof noteContentForComparisonSchema
>;

export async function getReviewableNote(
  noteId: string,
  userId: string,
): Promise<ReviewableNote | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("title, language, next_review_at, review_round")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const parsed = reviewableNoteSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getPendingReviewLog(
  noteId: string,
  userId: string,
): Promise<PendingReviewLog | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("review_logs")
    .select("id, note_id, round, scheduled_at, completed_at")
    .eq("note_id", noteId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("round", { ascending: false })
    .order("scheduled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const parsed = pendingReviewLogSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getNoteContentForComparison(
  noteId: string,
  userId: string,
): Promise<NoteContentForComparison | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("content, language")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const parsed = noteContentForComparisonSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
