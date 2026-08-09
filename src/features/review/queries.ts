import { z } from "zod";

import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { createServerComponentClient } from "@/lib/supabase/server";

import { getKstDayBoundsUtc } from "./lib/kstDay";
import { gradingFeedbackSchema } from "./schema";

const reviewableNoteSchema = z.object({
  title: z.string(),
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
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase
    .from("notes")
    .select("title, next_review_at, review_round")
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
  const supabase = await createServerComponentClient();
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

export async function hasCompletedReviewForNoteToday(
  noteId: string,
  userId: string,
): Promise<boolean> {
  const { startUtcIso, endUtcIso } = getKstDayBoundsUtc();
  const supabase = await createServerComponentClient();
  const { count, error } = await supabase
    .from("review_logs")
    .select("id", { count: "exact", head: true })
    .eq("note_id", noteId)
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .gte("completed_at", startUtcIso)
    .lt("completed_at", endUtcIso);

  if (error) throw error;

  return (count ?? 0) > 0;
}

export async function getNoteContentForComparison(
  noteId: string,
  userId: string,
): Promise<NoteContentForComparison | null> {
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase
    .from("notes")
    .select("content")
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const parsed = noteContentForComparisonSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

const reviewGradingSchema = z.object({
  id: z.string().uuid(),
  review_log_id: z.string().uuid(),
  round: z.number().int().min(1).max(MAX_REVIEW_ROUND),
  score: z.number().int().min(0).max(100),
  feedback: gradingFeedbackSchema,
  created_at: z.string(),
});

export type ReviewGrading = z.infer<typeof reviewGradingSchema>;

export async function getGradingByReviewLog(
  reviewLogId: string,
  userId: string,
): Promise<ReviewGrading | null> {
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase
    .from("review_gradings")
    .select("id, review_log_id, round, score, feedback, created_at")
    .eq("review_log_id", reviewLogId)
    .eq("user_id", userId)
    // score가 NULL인 행은 채점 진행 중 선점 행이므로 결과로 취급하지 않는다
    .not("score", "is", null)
    .maybeSingle();

  if (error) throw error;

  const parsed = reviewGradingSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getGradingsByNote(
  noteId: string,
  userId: string,
): Promise<ReviewGrading[]> {
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase
    .from("review_gradings")
    .select("id, review_log_id, round, score, feedback, created_at")
    .eq("note_id", noteId)
    .eq("user_id", userId)
    // 채점 진행 중 선점 행은 기록에 노출하지 않는다
    .not("score", "is", null)
    .order("round", { ascending: true });

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const parsed = reviewGradingSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
