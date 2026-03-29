import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountSection } from "@/features/mypage/components/AccountSection";
import { DeleteAccountSection } from "@/features/mypage/components/DeleteAccountSection";
import { LearningStatsSection } from "@/features/mypage/components/LearningStatsSection";
import {
  MypageNav,
  type MypageSection,
} from "@/features/mypage/components/MypageNav";
import { ProfileSection } from "@/features/mypage/components/ProfileSection";
import { getLearningStats, getProfile } from "@/features/mypage/queries";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
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

  const user = await getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const [profile, stats] = await Promise.all([
    getProfile(),
    getLearningStats(),
  ]);

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
              <ProfileSection profile={profile} email={user?.email ?? ""} />
              <AccountSection />
              <DeleteAccountSection userEmail={user?.email ?? ""} />
            </>
          )}
          {section === "stats" && <LearningStatsSection stats={stats} />}
        </div>
      </div>
    </div>
  );
}
