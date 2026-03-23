import { redirect } from "next/navigation";

import { AccountSection } from "@/features/mypage/components/AccountSection";
import { LearningStatsSection } from "@/features/mypage/components/LearningStatsSection";
import { ProfileSection } from "@/features/mypage/components/ProfileSection";
import type { LearningStats } from "@/features/mypage/queries";
import { getLearningStats, getProfile } from "@/features/mypage/queries";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profiles.types";

// TODO: 렌더링 확인용 목 데이터 — 확인 후 제거
const MOCK_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000000",
  nickname: "딱다구리",
  avatar_url: null,
  role: "USER",
  created_at: "2025-01-15T09:00:00Z",
  updated_at: "2025-03-20T12:00:00Z",
};

const MOCK_STATS: LearningStats = {
  totalNotes: 12,
  completedReviews: 28,
  pendingReviews: 5,
  reviewsByRound: [
    { round: 1, count: 15 },
    { round: 2, count: 9 },
    { round: 3, count: 4 },
  ],
  recentActivity: [
    { date: "2026-03-17", count: 3 },
    { date: "2026-03-18", count: 5 },
    { date: "2026-03-19", count: 2 },
    { date: "2026-03-20", count: 7 },
    { date: "2026-03-21", count: 4 },
    { date: "2026-03-22", count: 1 },
    { date: "2026-03-23", count: 6 },
  ],
};

export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let stats: LearningStats;

  if (user) {
    [profile, stats] = await Promise.all([getProfile(), getLearningStats()]);
  } else {
    // TODO: 렌더링 확인용 — 확인 후 아래 블록을 redirect(ROUTES.LOGIN)으로 교체
    profile = MOCK_PROFILE;
    stats = MOCK_STATS;
  }

  if (!profile) {
    redirect(ROUTES.LOGIN);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">마이페이지</h1>
      <ProfileSection profile={profile} />
      <LearningStatsSection stats={stats} />
      <AccountSection />
    </div>
  );
}
