import type { Metadata } from "next";

import { LegalPage } from "@/app/(legal)/LegalPage";
import { termsSections } from "@/components/legal/TermsSections";

export const metadata: Metadata = {
  title: "이용약관 | 딱다구리",
  description: "딱다구리 서비스 이용약관",
};

const EFFECTIVE_DATE = "2026년 3월 24일";

export default function TermsPage() {
  return (
    <LegalPage
      title="이용약관"
      effectiveDate={EFFECTIVE_DATE}
      intro="딱다구리 서비스를 이용하시면 아래 이용약관에 동의한 것으로 간주됩니다. 회원가입 전 아래 내용을 꼼꼼히 읽어주세요."
      sections={termsSections}
      crossLink={{ href: "/privacy", label: "개인정보 처리방침" }}
      footerNote={`부칙: 이 약관은 ${EFFECTIVE_DATE}부터 시행합니다.`}
    />
  );
}
