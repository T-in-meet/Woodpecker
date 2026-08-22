import type { Metadata } from "next";

import { LegalPage } from "@/app/(legal)/LegalPage";
import { privacySections } from "@/components/legal/PrivacySections";
import {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_NOTICE_DATE,
} from "@/lib/constants/legal";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | 딱다구리",
  description: "딱다구리 서비스 개인정보 처리방침",
  alternates: {
    canonical: `${SITE_URL}/privacy`,
    types: {
      "text/markdown": `${SITE_URL}/privacy.md`,
    },
  },
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
      markdownUrl={`${SITE_URL}/privacy.md`}
    />
  );
}
