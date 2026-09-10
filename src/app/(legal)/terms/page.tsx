import type { Metadata } from "next";

import { LegalPage } from "@/app/(legal)/LegalPage";
import { termsSections } from "@/components/legal/TermsSections";
import {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_NOTICE_DATE,
} from "@/lib/constants/legal";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { buildSocialMetadata } from "@/lib/seo/socialMetadata";

const pageTitle = "이용약관";
const pageDescription =
  "딱다구리 서비스 이용 조건입니다. 서비스 제공 범위, 회원 콘텐츠와 지식재산권, AI 기능 이용, 이용 제한, 책임의 제한 등 15개 조항을 담았습니다.";
const pageUrl = `${SITE_URL}/terms`;

/* openGraph·twitter를 선언하지 않으면 루트 레이아웃의 값(= 홈 문구)을 그대로
   물려받아, 링크를 공유했을 때 미리보기 제목이 이 페이지와 무관해진다.
   공유 카드에는 브랜드까지 함께 보이는 편이 읽기 좋아 title에 접미사를 붙인다.
   <title>은 루트의 template이 알아서 붙이므로 접미사를 넣지 않는다. */
export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pageUrl,
    types: {
      "text/markdown": `${SITE_URL}/terms.md`,
    },
  },
  ...buildSocialMetadata({
    title: `${pageTitle} | ${SITE_NAME}`,
    description: pageDescription,
    url: pageUrl,
  }),
};

export default function TermsPage() {
  const effectiveDate = formatLegalDate(LEGAL_EFFECTIVE_DATE);
  const noticeDate = formatLegalDate(LEGAL_NOTICE_DATE);

  return (
    <LegalPage
      title="이용약관"
      effectiveDate={effectiveDate}
      intro={`딱다구리 서비스 이용 조건을 정한 약관입니다. 이 개정 약관은 ${noticeDate}에 공개되며 시행 전에도 동의할 수 있습니다.`}
      sections={termsSections}
      crossLink={{ href: "/privacy", label: "개인정보 처리방침" }}
      footerNote={`부칙: 이 약관은 ${effectiveDate}부터 시행합니다.`}
    />
  );
}
