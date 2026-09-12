import { z } from "zod";

import { NOTES_PAGE_SIZE } from "@/lib/constants/notes";
import { logError } from "@/lib/logger";
import { createServerComponentClient } from "@/lib/supabase/server";
import { escapePostgrestLikePattern } from "@/lib/utils/escapePostgrestLikePattern";

import type { NoteView } from "./schema";

const noteDetailSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  next_review_at: z.string().nullable(),
  notification_time_of_day: z.string().nullable(),
  review_completed_at: z.string().nullable(),
  // 누적 복습 횟수. 상한이 없다.
  review_round: z.number().int().min(0),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid(),
});

const noteSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  next_review_at: z.string().nullable(),
  review_completed_at: z.string().nullable(),
  // 누적 복습 횟수. 상한이 없다.
  review_round: z.number().int().min(0),
});
const NOTE_SUMMARY_SELECT =
  "id, title, content, next_review_at, review_completed_at, review_round" as const;

// next_scheduled_at는 notes 테이블 컬럼이 아니라 pending review_logs.scheduled_at에서
// 파생된 실제 알림 발송 시각이다. notes.next_review_at은 KST 자정 마커이므로 시:분
// 표시에는 사용할 수 없어 별도 필드로 합쳐 반환한다 (이슈 #215 설계 결정).
export type NoteDetail = z.infer<typeof noteDetailSchema> & {
  next_scheduled_at: string | null;
};
export type NoteSummary = z.infer<typeof noteSummarySchema>;

// "복습 대기 중"(아직 복습할 때가 아닌 노트) 판정 조건. 미래에 예정된 노트와
// 아직 한 번도 복습하지 않은 노트(next_review_at이 null이면서 round 0)를 포함한다.
function buildScheduledFilter(nowIso: string): string {
  return `next_review_at.gt.${nowIso},and(next_review_at.is.null,review_round.eq.0)`;
}

function parseNoteSummaries(
  data: unknown,
  queryName: string,
): NoteSummary[] | null {
  const parsed = z.array(noteSummarySchema).safeParse(data);

  if (parsed.success) return parsed.data;

  logError({
    message: `[${queryName}] noteSummarySchema 파싱 실패`,
    error: parsed.error,
  });
  return null;
}

export async function getNotes(
  userId: string,
  page = 1,
  search = "",
  pageSize = NOTES_PAGE_SIZE,
  view: NoteView = "all",
): Promise<{ notes: NoteSummary[]; total: number }> {
  const supabase = await createServerComponentClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notes")
    .select(NOTE_SUMMARY_SELECT, {
      count: "exact",
    })
    .eq("user_id", userId);

  const nowIso = new Date().toISOString();

  // 복습을 그만두는 유일한 경로는 사용자의 완료 표시다. completed 보기만 완료 노트를
  // 모으고, 할 일을 보여주는 나머지 보기는 모두 완료 노트를 뺀다. 보기가 늘어나도 이
  // 전제를 각 분기가 따로 챙기지 않도록 분기 앞에서 한 번만 건다.
  if (view === "completed") {
    query = query.not("review_completed_at", "is", null);
  } else if (view === "due" || view === "scheduled") {
    query = query.is("review_completed_at", null);

    query =
      view === "due"
        ? query.lte("next_review_at", nowIso)
        : query.or(buildScheduledFilter(nowIso));
  }

  if (search.trim()) {
    const term = escapePostgrestLikePattern(search.trim()).replace(/"/g, '\\"');
    query = query.or(`title.ilike."%${term}%",content.ilike."%${term}%"`);
  }

  query =
    view === "due" || view === "scheduled"
      ? query
          .order("next_review_at", {
            ascending: true,
            nullsFirst: false,
          })
          // 같은 날 예정된 노트끼리는 최근에 만든 노트를 먼저 보여준다.
          .order("created_at", { ascending: false })
      : query.order("updated_at", { ascending: false });

  const { data, count, error } = await query.range(from, to);

  if (error) throw error;

  const notes = parseNoteSummaries(data, "getNotes");

  return { notes: notes ?? [], total: count ?? 0 };
}

export async function getNoteById(
  noteId: string,
  userId: string,
): Promise<NoteDetail | null> {
  const supabase = await createServerComponentClient();

  const notePromise = supabase
    .from("notes")
    .select(
      "id, title, content, next_review_at, notification_time_of_day, review_completed_at, review_round, created_at, updated_at, user_id",
    )
    .eq("id", noteId)
    .eq("user_id", userId)
    .maybeSingle();

  const pendingLogPromise = supabase
    .from("review_logs")
    .select("scheduled_at")
    .eq("note_id", noteId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const [{ data }, { data: pendingLog }] = await Promise.all([
    notePromise,
    pendingLogPromise,
  ]);

  const parsed = noteDetailSchema.safeParse(data);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    next_scheduled_at:
      typeof pendingLog?.scheduled_at === "string"
        ? pendingLog.scheduled_at
        : null,
  };
}
