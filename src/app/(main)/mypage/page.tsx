import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountSection } from "@/features/mypage/components/AccountSection";
import { DeleteAccountSection } from "@/features/mypage/components/DeleteAccountSection";
import { LearningStatsSection } from "@/features/mypage/components/LearningStatsSection";
import { LogoutSection } from "@/features/mypage/components/LogoutSection";
import {
  MypageNav,
  type MypageSection,
} from "@/features/mypage/components/MypageNav";
import { ProfileSection } from "@/features/mypage/components/ProfileSection";
import type { LearningStats } from "@/features/mypage/queries";
import { getLearningStats, getProfile } from "@/features/mypage/queries";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/profiles.types";

// TODO: 렌더링 확인용 목 데이터 — 확인 후 제거
// 현재는 목 데이터로 페이지를 보여주고 있어서, 폼을 제출하면 서버 액션이 user를 못 찾아서 "인증이 필요합니다"를 반환

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

const VALID_SECTIONS: MypageSection[] = ["profile", "stats"];

function isValidSection(value: unknown): value is MypageSection {
  return VALID_SECTIONS.includes(value as MypageSection);
}

const SECTION_LABELS: Record<MypageSection, string> = {
  profile: "프로필",
  stats: "학습 통계",
};

type Props = {
  searchParams: Promise<{ section?: string }>;
};

export default async function MyPage({ searchParams }: Props) {
  const { section: rawSection } = await searchParams;
  const section: MypageSection = isValidSection(rawSection)
    ? rawSection
    : "profile";

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
    <div className="mx-auto max-w-5xl py-7 px-6">
      {/* Breadcrumb */}
      <nav
        aria-label="breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link
          href={ROUTES.HOME}
          className="transition-colors hover:text-foreground"
        >
          홈
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          href={ROUTES.MYPAGE}
          className="transition-colors hover:text-foreground"
        >
          마이페이지
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">
          {SECTION_LABELS[section]}
        </span>
      </nav>

      {/* 페이지 타이틀 */}
      <h1 className="mt-6 mb-6 text-3xl font-bold">마이페이지</h1>

      {/* 모바일 탭 */}
      <div className="mb-6 md:hidden">
        <MypageNav activeSection={section} />
      </div>

      {/* 데스크탑: 2컬럼 레이아웃 */}
      <div className="flex gap-8">
        <div className="hidden md:block">
          <MypageNav activeSection={section} />
        </div>

        <div className="flex-1 space-y-6">
          {section === "profile" && (
            <>
              <ProfileSection profile={profile} />
              <LogoutSection />
              <AccountSection />
              <DeleteAccountSection />
            </>
          )}
          {section === "stats" && <LearningStatsSection stats={stats} />}
        </div>
      </div>
    </div>
  );
}
