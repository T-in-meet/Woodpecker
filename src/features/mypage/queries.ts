import { getKstDayBoundsUtc } from "@/features/review/lib/kstDay";
import { logError } from "@/lib/logger";
import { getUser } from "@/lib/supabase/getUser";
import { createServerComponentClient } from "@/lib/supabase/server";

export type LearningStats = {
  totalNotes: number;
  completedReviews: number;
  todayReviews: number;
  reviewWaitingCount: number;
  notesByRound: { round: number; count: number }[];
  recentActivity: { date: string; count: number }[];
  studyStreak: { current: number; longest: number };
  onTimeRate: { completed: number; onTime: number };
};

const ACTIVITY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const kstDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toKstDateKey(iso: string): string {
  return kstDateFormatter.format(new Date(iso));
}

function shiftKstDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function computeStreak(
  activityDays: Set<string>,
  todayKey: string,
): { current: number; longest: number } {
  if (activityDays.size === 0) return { current: 0, longest: 0 };

  // 오늘 미완료여도 어제까지 이어졌으면 현재 streak로 인정
  let cursor = activityDays.has(todayKey)
    ? todayKey
    : shiftKstDateKey(todayKey, -1);
  let current = 0;
  while (activityDays.has(cursor)) {
    current += 1;
    cursor = shiftKstDateKey(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of Array.from(activityDays).sort()) {
    if (prev !== null && shiftKstDateKey(prev, 1) === day) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = day;
  }

  return { current, longest };
}

export async function getLearningStats(): Promise<LearningStats> {
  const user = await getUser();

  const empty: LearningStats = {
    totalNotes: 0,
    completedReviews: 0,
    todayReviews: 0,
    reviewWaitingCount: 0,
    notesByRound: [],
    recentActivity: [],
    studyStreak: { current: 0, longest: 0 },
    onTimeRate: { completed: 0, onTime: 0 },
  };

  if (!user) return empty;

  const supabase = await createServerComponentClient();

  const [notesResult, reviewLogsResult] = await Promise.all([
    supabase
      .from("notes")
      .select("review_round, next_review_at")
      .eq("user_id", user.id),
    supabase
      .from("review_logs")
      .select("round, scheduled_at, completed_at")
      .eq("user_id", user.id),
  ]);

  const now = new Date();
  const nowIso = now.toISOString();
  const { startUtcIso: startOfTodayKstUtc, endUtcIso: endOfTodayKstUtc } =
    getKstDayBoundsUtc(now);
  const todayKstKey = toKstDateKey(nowIso);
  const activityCutoffIso = new Date(
    now.getTime() - ACTIVITY_DAYS * DAY_MS,
  ).toISOString();

  const notesRows = notesResult.data ?? [];
  const totalNotes = notesRows.length;

  const reviewWaitingCount = notesRows.filter(
    (n) =>
      (n.next_review_at === null && n.review_round === 0) ||
      (typeof n.next_review_at === "string" && n.next_review_at > nowIso),
  ).length;

  const notesByRoundMap = new Map<number, number>([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  for (const row of notesRows) {
    const r = row.review_round;
    if (typeof r === "number" && notesByRoundMap.has(r)) {
      notesByRoundMap.set(r, (notesByRoundMap.get(r) ?? 0) + 1);
    }
  }
  const notesByRound = Array.from(notesByRoundMap.entries())
    .map(([round, count]) => ({ round, count }))
    .sort((a, b) => a.round - b.round);

  const logs = reviewLogsResult.data ?? [];

  let completedReviews = 0;
  let todayReviews = 0;
  let onTime = 0;

  const activityDayCounts = new Map<string, number>();
  const activityDaySet = new Set<string>();

  for (const row of logs) {
    const scheduledAt = row.scheduled_at;
    const completedAt = row.completed_at;
    if (typeof row.round !== "number" || typeof scheduledAt !== "string")
      continue;

    if (typeof completedAt === "string") {
      completedReviews += 1;

      const completedKey = toKstDateKey(completedAt);
      const scheduledKey = toKstDateKey(scheduledAt);
      if (completedKey <= scheduledKey) onTime += 1;

      activityDaySet.add(completedKey);
      if (completedAt >= activityCutoffIso) {
        activityDayCounts.set(
          completedKey,
          (activityDayCounts.get(completedKey) ?? 0) + 1,
        );
      }
    } else if (
      scheduledAt >= startOfTodayKstUtc &&
      scheduledAt < endOfTodayKstUtc
    ) {
      todayReviews += 1;
    }
  }

  const recentActivity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const dayKey = shiftKstDateKey(todayKstKey, -(ACTIVITY_DAYS - 1 - i));
    return { date: dayKey, count: activityDayCounts.get(dayKey) ?? 0 };
  });

  const studyStreak = computeStreak(activityDaySet, todayKstKey);

  return {
    totalNotes,
    completedReviews,
    todayReviews,
    reviewWaitingCount,
    notesByRound,
    recentActivity,
    studyStreak,
    onTimeRate: { completed: completedReviews, onTime },
  };
}

// ---- 피드백 (#266) ----

export type FeedbackImage = { path: string; url: string | null };

export type MyFeedbackReply = {
  title: string;
  content: string;
  created_at: string;
  images: FeedbackImage[];
};

export type MyFeedback = {
  id: string;
  category: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  note: { id: string; title: string } | null;
  images: FeedbackImage[];
  reply: MyFeedbackReply | null;
};

export type MyFeedbacksResult = {
  feedbacks: MyFeedback[];
  hasSubmittedToday: boolean;
};

// private 버킷이므로 이미지는 서명 URL로만 접근 가능
const FEEDBACK_SIGNED_URL_EXPIRES_IN = 60 * 60; // 1시간

async function createSignedUrlMap(
  supabase: Awaited<ReturnType<typeof createServerComponentClient>>,
  bucket: "feedbacks" | "feedback_replies",
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, FEEDBACK_SIGNED_URL_EXPIRES_IN);

  if (error || !data) {
    logError(
      `[getMyFeedbacks] ${bucket} 서명 URL 생성 실패: ${error?.message}`,
    );
    return new Map();
  }

  const map = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

function toFeedbackImages(
  paths: string[],
  urlMap: Map<string, string>,
): FeedbackImage[] {
  return paths.map((path) => ({ path, url: urlMap.get(path) ?? null }));
}

export async function getMyFeedbacks(
  userId: string,
): Promise<MyFeedbacksResult> {
  const supabase = await createServerComponentClient();

  const { data, error } = await supabase
    .from("feedbacks")
    .select(
      "id, category, title, content, image_urls, status, created_at, note:notes(id, title), reply:feedback_replies(title, content, image_paths, created_at)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    logError(`[getMyFeedbacks] 피드백 조회 실패: ${error.message}`);
    return { feedbacks: [], hasSubmittedToday: false };
  }

  const rows = data ?? [];

  const [feedbackUrlMap, replyUrlMap] = await Promise.all([
    createSignedUrlMap(
      supabase,
      "feedbacks",
      rows.flatMap((row) => row.image_urls),
    ),
    createSignedUrlMap(
      supabase,
      "feedback_replies",
      rows.flatMap((row) => row.reply?.image_paths ?? []),
    ),
  ]);

  const todayKstKey = toKstDateKey(new Date().toISOString());

  const feedbacks: MyFeedback[] = rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    status: row.status,
    created_at: row.created_at,
    note: row.note,
    images: toFeedbackImages(row.image_urls, feedbackUrlMap),
    reply: row.reply
      ? {
          title: row.reply.title,
          content: row.reply.content,
          created_at: row.reply.created_at,
          images: toFeedbackImages(row.reply.image_paths, replyUrlMap),
        }
      : null,
  }));

  const hasSubmittedToday = feedbacks.some(
    (feedback) => toKstDateKey(feedback.created_at) === todayKstKey,
  );

  return { feedbacks, hasSubmittedToday };
}
