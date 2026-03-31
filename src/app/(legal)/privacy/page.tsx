import type { Metadata } from "next";

import { LegalPage } from "@/app/(legal)/LegalPage";
import { privacySections } from "@/components/legal/PrivacySections";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | 딱다구리",
  description: "딱다구리 서비스 개인정보 처리방침",
};

const EFFECTIVE_DATE = "2026년 3월 24일";

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보 처리방침"
      effectiveDate={EFFECTIVE_DATE}
      intro="딱다구리는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리합니다."
      sections={privacySections}
      crossLink={{ href: "/terms", label: "이용약관" }}
      footerNote={`부칙: 이 개인정보 처리방침은 ${EFFECTIVE_DATE}부터 시행합니다.`}
    />
  );
}
