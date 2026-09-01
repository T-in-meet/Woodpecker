import { z } from "zod";

import { createServerComponentClient } from "@/lib/supabase/server";

import { gradingFeedbackSchema } from "./schema";

const reviewableNoteSchema = z.object({
  title: z.string(),
  next_review_at: z.string().nullable(),
  review_completed_at: z.string().nullable(),
  // 누적 복습 횟수. 상한이 없다.
  review_round: z.number().int().min(0),
});

const pendingReviewLogSchema = z.object({
  id: z.string().uuid(),
  note_id: z.string().uuid(),
  round: z.number().int().min(1),
  scheduled_at: z.string(),
  completed_at: z.string().nullable(),
});

// 화면에 보여준 원본과 채점 기준 원본이 같은지는 본문 해시(hashNoteContent)로 확인한다.
// updated_at은 본문과 무관한 UPDATE에도 바뀌므로 쓰지 않는다. 상세는 lib/contentHash.ts.
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
    .select("title, next_review_at, review_completed_at, review_round")
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
  round: z.number().int().min(1),
  score: z.number().int().min(0).max(100),
  feedback: gradingFeedbackSchema,
  created_at: z.string(),
});

// 저장된 채점이 지금 화면의 답안·원본을 채점한 것인지 비교해야 하는 곳에서만
// 답안과 기준 원본 해시까지 읽는다. 답안은 최대 5만 자라 목록 조회에서는 가져오지 않는다.
// graded_content_hash는 해시 도입 이전 행에서 NULL이므로 nullable이다.
const reviewGradingWithAnswerSchema = reviewGradingSchema.extend({
  user_answer: z.string(),
  graded_content_hash: z.string().nullable(),
});

export type ReviewGrading = z.infer<typeof reviewGradingSchema>;
export type ReviewGradingWithAnswer = z.infer<
  typeof reviewGradingWithAnswerSchema
>;

export async function getGradingByReviewLog(
  reviewLogId: string,
  userId: string,
): Promise<ReviewGradingWithAnswer | null> {
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase
    .from("review_gradings")
    .select(
      "id, review_log_id, round, user_answer, score, feedback, created_at, graded_content_hash",
    )
    .eq("review_log_id", reviewLogId)
    .eq("user_id", userId)
    // score가 NULL인 행은 채점 진행 중 선점 행이므로 결과로 취급하지 않는다
    .not("score", "is", null)
    .maybeSingle();

  if (error) throw error;

  const parsed = reviewGradingWithAnswerSchema.safeParse(data);
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
    .order("round", { ascending: false });

  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    const parsed = reviewGradingSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}
