import { z } from "zod";

import { getUser } from "@/lib/supabase/getUser";
import { createClient } from "@/lib/supabase/server";

export { getUser };

export type LearningStats = {
  totalNotes: number;
  completedReviews: number;
  pendingReviews: number;
  reviewsByRound: { round: number; count: number }[];
  recentActivity: { date: string; count: number }[];
};

const profileDbSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatar_url: z.string().nullable(),
  role: z.enum(["USER", "ADMIN"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export async function getProfile() {
  const user = await getUser();

  if (!user) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const parsed = profileDbSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function getLearningStats(): Promise<LearningStats> {
  const user = await getUser();

  const empty: LearningStats = {
    totalNotes: 0,
    completedReviews: 0,
    pendingReviews: 0,
    reviewsByRound: [],
    recentActivity: [],
  };

  if (!user) return empty;

  const supabase = await createClient();

  const [
    notesResult,
    completedResult,
    pendingResult,
    roundsResult,
    activityResult,
  ] = await Promise.all([
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),

    supabase
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("completed_at", "is", null),

    supabase
      .from("review_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("completed_at", null)
      .lte("scheduled_at", new Date().toISOString()),

    supabase
      .from("review_logs")
      .select("round")
      .eq("user_id", user.id)
      .not("completed_at", "is", null),

    supabase
      .from("review_logs")
      .select("completed_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .gte(
        "completed_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ),
  ]);

  const roundCounts = new Map<number, number>();
  if (roundsResult.data) {
    for (const row of roundsResult.data) {
      const r = row.round;
      roundCounts.set(r, (roundCounts.get(r) ?? 0) + 1);
    }
  }

  const dateCounts = new Map<string, number>();
  if (activityResult.data) {
    for (const row of activityResult.data) {
      if (row.completed_at) {
        const date = row.completed_at.slice(0, 10);
        dateCounts.set(date, (dateCounts.get(date) ?? 0) + 1);
      }
    }
  }

  const today = new Date();
  const recentActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const date = d.toISOString().slice(0, 10);
    return { date, count: dateCounts.get(date) ?? 0 };
  });

  return {
    totalNotes: notesResult.count ?? 0,
    completedReviews: completedResult.count ?? 0,
    pendingReviews: pendingResult.count ?? 0,
    reviewsByRound: Array.from(roundCounts.entries())
      .map(([round, count]) => ({ round, count }))
      .sort((a, b) => a.round - b.round),
    recentActivity,
  };
}
