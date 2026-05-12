import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LearningStatsSection } from "@/features/mypage/components/LearningStatsSection";
import {
  MypageNav,
  type MypageSection,
} from "@/features/mypage/components/MypageNav";
import { ReviewWaitingSection } from "@/features/mypage/components/ReviewWaitingSection";
import { getLearningStats } from "@/features/mypage/queries";
import { getReviewWaitingNotes } from "@/features/notes/queries";
import { PushSubscribeCard } from "@/features/notifications/components/PushSubscribeCard";
import { getHasAnyPushSubscription } from "@/features/notifications/queries";
import { ROUTES } from "@/lib/constants/routes";
import { getProfile } from "@/lib/supabase/getProfile";
import { getUser } from "@/lib/supabase/getUser";

const ProfileSection = dynamic(() =>
  import("@/features/mypage/components/ProfileSection").then(
    (m) => m.ProfileSection,
  ),
);
const AccountSection = dynamic(() =>
  import("@/features/mypage/components/AccountSection").then(
    (m) => m.AccountSection,
  ),
);
const DeleteAccountSection = dynamic(() =>
  import("@/features/mypage/components/DeleteAccountSection").then(
    (m) => m.DeleteAccountSection,
  ),
);

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const VALID_SECTIONS: MypageSection[] = ["profile", "stats", "reviews"];

function isValidSection(value: unknown): value is MypageSection {
  return VALID_SECTIONS.includes(value as MypageSection);
}

const SECTION_LABELS: Record<MypageSection, string> = {
  profile: "계정 관리",
  stats: "학습 통계",
  reviews: "복습 대기",
};

type Props = {
  searchParams: Promise<{ section?: string }>;
};

export default async function MyPage({ searchParams }: Props) {
  const { section: rawSection } = await searchParams;
  const section: MypageSection = isValidSection(rawSection)
    ? rawSection
    : "stats";

  const [user, profile] = await Promise.all([getUser(), getProfile()]);
  if (!user || !profile) redirect(ROUTES.LOGIN);

  // 활성 section에서만 fetch
  let stats: Awaited<ReturnType<typeof getLearningStats>> | null = null;
  let hasAnyPushSubscription = false;
  let reviewWaiting: Awaited<ReturnType<typeof getReviewWaitingNotes>> = [];

  if (section === "stats") {
    stats = await getLearningStats();
  } else if (section === "profile") {
    hasAnyPushSubscription = await getHasAnyPushSubscription({
      userId: user.id,
    });
  } else if (section === "reviews") {
    reviewWaiting = await getReviewWaitingNotes(user.id);
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
              <PushSubscribeCard
                initialHasAnySubscription={hasAnyPushSubscription}
              />
              <AccountSection />
              <DeleteAccountSection userEmail={user?.email ?? ""} />
            </>
          )}
          {section === "stats" && stats && (
            <LearningStatsSection stats={stats} />
          )}
          {section === "reviews" && (
            <ReviewWaitingSection notes={reviewWaiting} />
          )}
        </div>
      </div>
    </div>
  );
}
