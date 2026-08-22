import type { Metadata } from "next";

import { LegalPage } from "@/app/(legal)/LegalPage";
import { termsSections } from "@/components/legal/TermsSections";
import {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_NOTICE_DATE,
} from "@/lib/constants/legal";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "이용약관 | 딱다구리",
  description: "딱다구리 서비스 이용약관",
  alternates: {
    canonical: `${SITE_URL}/terms`,
    types: {
      "text/markdown": `${SITE_URL}/terms.md`,
    },
  },
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
      markdownUrl={`${SITE_URL}/terms.md`}
    />
  );
}
