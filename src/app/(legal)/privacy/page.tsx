import type { Metadata } from "next";

import { LegalPage } from "@/app/(legal)/LegalPage";
import { privacySections } from "@/components/legal/PrivacySections";
import {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_NOTICE_DATE,
} from "@/lib/constants/legal";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { buildSocialMetadata } from "@/lib/seo/socialMetadata";

const pageTitle = "개인정보 처리방침";
const pageDescription =
  "딱다구리가 처리하는 개인정보의 항목과 목적, 보유 기간, 처리 위탁과 국외 이전, 정보주체의 권리 행사 방법 등 14개 조항을 안내합니다.";
const pageUrl = `${SITE_URL}/privacy`;

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
      "text/markdown": `${SITE_URL}/privacy.md`,
    },
  },
  ...buildSocialMetadata({
    title: `${pageTitle} | ${SITE_NAME}`,
    description: pageDescription,
    url: pageUrl,
  }),
};

export default function PrivacyPage() {
  const effectiveDate = formatLegalDate(LEGAL_EFFECTIVE_DATE);
  const noticeDate = formatLegalDate(LEGAL_NOTICE_DATE);

  return (
    <LegalPage
      title="개인정보 처리방침"
      effectiveDate={effectiveDate}
      intro={`딱다구리는 개인정보 보호법 등 관련 법령에 따라 이용자의 개인정보를 보호합니다. 이 개정 방침은 ${noticeDate}에 공개되며 시행 전에도 확인할 수 있습니다.`}
      sections={privacySections}
      crossLink={{ href: "/terms", label: "이용약관" }}
      footerNote={`부칙: 이 개인정보 처리방침은 ${effectiveDate}부터 시행합니다.`}
    />
  );
}
