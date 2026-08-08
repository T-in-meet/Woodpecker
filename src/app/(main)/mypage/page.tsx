import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LearningStatsSection } from "@/features/mypage/components/LearningStatsSection";
import {
  MypageNav,
  type MypageSection,
} from "@/features/mypage/components/MypageNav";
import { ReviewWaitingSection } from "@/features/mypage/components/ReviewWaitingSection";
import type { SupportTab } from "@/features/mypage/components/SupportSection";
import {
  getLearningStats,
  getMyFeedbacks,
  type MyFeedbacksResult,
} from "@/features/mypage/queries";
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
const SupportSection = dynamic(() =>
  import("@/features/mypage/components/SupportSection").then(
    (m) => m.SupportSection,
  ),
);

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const VALID_SECTIONS: MypageSection[] = [
  "profile",
  "stats",
  "reviews",
  "support",
];

function isValidSection(value: unknown): value is MypageSection {
  return VALID_SECTIONS.includes(value as MypageSection);
}

const SECTION_LABELS: Record<MypageSection, string> = {
  profile: "계정 관리",
  stats: "학습 통계",
  reviews: "복습 대기",
  support: "고객센터",
};

const VALID_SUPPORT_TABS: SupportTab[] = ["faq", "inquiry"];

const VALID_PROFILE_NICKNAME_NOTICES = ["provider", "fallback"] as const;

type ProfileNicknameNotice = (typeof VALID_PROFILE_NICKNAME_NOTICES)[number];

function isValidSupportTab(value: unknown): value is SupportTab {
  return VALID_SUPPORT_TABS.includes(value as SupportTab);
}

/**
 * 프로필 닉네임 안내 query 값이 지원되는 값인지 확인합니다.
 */
function isValidProfileNicknameNotice(
  value: unknown,
): value is ProfileNicknameNotice {
  return VALID_PROFILE_NICKNAME_NOTICES.includes(
    value as ProfileNicknameNotice,
  );
}

const SUPPORT_TAB_LABELS: Record<SupportTab, string> = {
  faq: "FAQ",
  inquiry: "1:1 문의",
};

type Props = {
  searchParams: Promise<{
    section?: string;
    tab?: string;
    profile_nickname?: string;
  }>;
};

export default async function MyPage({ searchParams }: Props) {
  const {
    section: rawSection,
    tab: rawTab,
    profile_nickname: rawProfileNicknameNotice,
  } = await searchParams;
  const section: MypageSection = isValidSection(rawSection)
    ? rawSection
    : "stats";
  const supportTab: SupportTab = isValidSupportTab(rawTab) ? rawTab : "faq";
  const profileNicknameNotice =
    section === "profile" &&
    isValidProfileNicknameNotice(rawProfileNicknameNotice)
      ? rawProfileNicknameNotice
      : null;

  const [user, profile] = await Promise.all([getUser(), getProfile()]);
  if (!user || !profile) redirect(ROUTES.LOGIN);
  if (user.email_confirmed_at == null)
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);

  // 활성 section에서만 fetch
  let stats: Awaited<ReturnType<typeof getLearningStats>> | null = null;
  let hasAnyPushSubscription = false;
  let reviewWaiting: Awaited<ReturnType<typeof getReviewWaitingNotes>> = [];
  let feedbackResult: MyFeedbacksResult | null = null;

  if (section === "stats") {
    stats = await getLearningStats();
  } else if (section === "profile") {
    hasAnyPushSubscription = await getHasAnyPushSubscription({
      userId: user.id,
    });
  } else if (section === "reviews") {
    reviewWaiting = await getReviewWaitingNotes(user.id);
  } else if (section === "support" && supportTab === "inquiry") {
    feedbackResult = await getMyFeedbacks(user.id);
  }

  return (
    <div className="mx-auto max-w-5xl py-7 px-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ROUTES.HOME}>홈</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={ROUTES.MYPAGE}>마이페이지</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {section === "support" ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`${ROUTES.MYPAGE}?section=support`}>
                    {SECTION_LABELS[section]}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">
                  {SUPPORT_TAB_LABELS[supportTab]}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium">
                {SECTION_LABELS[section]}
              </BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>

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
              <ProfileSection
                profile={profile}
                email={user?.email ?? ""}
                nicknameNotice={profileNicknameNotice}
              />
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
          {section === "support" && (
            <SupportSection
              activeTab={supportTab}
              feedbacks={feedbackResult?.feedbacks ?? []}
              hasSubmittedToday={feedbackResult?.hasSubmittedToday ?? false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
