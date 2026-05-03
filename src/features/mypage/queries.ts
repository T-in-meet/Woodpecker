import { getKstDayBoundsUtc } from "@/features/review/lib/kstDay";
import { getUser } from "@/lib/supabase/getUser";
import { createServerComponentClient } from "@/lib/supabase/server";

export type LearningStats = {
  totalNotes: number;
  completedReviews: number;
  todayReviews: number;
  reviewsByRound: { round: number; scheduled: number; completed: number }[];
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
    reviewsByRound: [],
    notesByRound: [],
    recentActivity: [],
    studyStreak: { current: 0, longest: 0 },
    onTimeRate: { completed: 0, onTime: 0 },
  };

  if (!user) return empty;

  const supabase = await createServerComponentClient();

  const [notesResult, reviewLogsResult] = await Promise.all([
    supabase.from("notes").select("review_round").eq("user_id", user.id),
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

  const byRound = new Map<number, { scheduled: number; completed: number }>([
    [1, { scheduled: 0, completed: 0 }],
    [2, { scheduled: 0, completed: 0 }],
    [3, { scheduled: 0, completed: 0 }],
  ]);
  const activityDayCounts = new Map<string, number>();
  const activityDaySet = new Set<string>();

  for (const row of logs) {
    const round = row.round;
    const scheduledAt = row.scheduled_at;
    const completedAt = row.completed_at;
    if (typeof round !== "number" || typeof scheduledAt !== "string") continue;

    const bucket = byRound.get(round);
    if (bucket) {
      bucket.scheduled += 1;
      if (completedAt) bucket.completed += 1;
    }

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

  const reviewsByRound = Array.from(byRound.entries())
    .map(([round, v]) => ({
      round,
      scheduled: v.scheduled,
      completed: v.completed,
    }))
    .sort((a, b) => a.round - b.round);

  const recentActivity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => {
    const dayKey = shiftKstDateKey(todayKstKey, -(ACTIVITY_DAYS - 1 - i));
    return { date: dayKey, count: activityDayCounts.get(dayKey) ?? 0 };
  });

  const studyStreak = computeStreak(activityDaySet, todayKstKey);

  return {
    totalNotes,
    completedReviews,
    todayReviews,
    reviewsByRound,
    notesByRound,
    recentActivity,
    studyStreak,
    onTimeRate: { completed: completedReviews, onTime },
  };
}
