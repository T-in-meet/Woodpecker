import { z } from "zod";

import { getKstDayBoundsUtc } from "@/features/review/lib/kstDay";
import { NOTES_LIST_PAGE_SIZE } from "@/lib/constants/notes";
import { MAX_REVIEW_ROUND } from "@/lib/constants/reviewIntervals";
import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { escapePostgrestLikePattern } from "@/lib/utils/escapePostgrestLikePattern";

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

// next_scheduled_at는 notes 테이블 컬럼이 아니라 pending review_logs.scheduled_at에서
// 파생된 실제 알림 발송 시각이다. notes.next_review_at은 KST 자정 마커이므로 시:분
// 표시에는 사용할 수 없어 별도 필드로 합쳐 반환한다 (이슈 #215 설계 결정).
export type NoteDetail = z.infer<typeof noteDetailSchema> & {
  next_scheduled_at: string | null;
};
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
    const term = escapePostgrestLikePattern(search.trim()).replace(/"/g, '\\"');
    query = query.or(`title.ilike."%${term}%",content.ilike."%${term}%"`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) throw error;

  const parsed = z.array(noteSummarySchema).safeParse(data);

  if (!parsed.success) {
    logError({
      message: "[getNotes] noteSummarySchema 파싱 실패",
      error: parsed.error,
    });
  }

  return { notes: parsed.success ? parsed.data : [], total: count ?? 0 };
}

export async function getTodayReviewNotes(
  userId: string,
  page = 1,
  pageSize = 9,
): Promise<{ notes: NoteSummary[]; total: number }> {
  const supabase = await createServerComponentClient();
  const { startUtcIso, endUtcIso } = getKstDayBoundsUtc();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("notes")
    .select(
      "id, title, content, next_review_at, review_round, created_at, updated_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .gte("next_review_at", startUtcIso)
    .lt("next_review_at", endUtcIso)
    .order("next_review_at", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const parsed = z.array(noteSummarySchema).safeParse(data);

  if (!parsed.success) {
    logError({
      message: "[getTodayReviewNotes] noteSummarySchema 파싱 실패",
      error: parsed.error,
    });
    return { notes: [], total: 0 };
  }

  return { notes: parsed.data, total: count ?? 0 };
}

export async function getReviewWaitingNotes(
  userId: string,
): Promise<NoteSummary[]> {
  const supabase = await createServerComponentClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("notes")
    .select(
      "id, title, content, next_review_at, review_round, created_at, updated_at",
    )
    .eq("user_id", userId)
    .or(
      `next_review_at.gt.${nowIso},and(next_review_at.is.null,review_round.eq.0)`,
    )
    .order("next_review_at", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error) throw error;

  const parsed = z.array(noteSummarySchema).safeParse(data);

  if (!parsed.success) {
    logError({
      message: "[getReviewWaitingNotes] noteSummarySchema 파싱 실패",
      error: parsed.error,
    });
    return [];
  }

  return parsed.data;
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
  if (!parsed.success) return null;

  const { data: pendingLog } = await supabase
    .from("review_logs")
    .select("scheduled_at")
    .eq("note_id", noteId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    ...parsed.data,
    next_scheduled_at:
      typeof pendingLog?.scheduled_at === "string"
        ? pendingLog.scheduled_at
        : null,
  };
}
