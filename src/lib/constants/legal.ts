export const LEGAL_NOTICE_DATE = "2026-08-21";
export const LEGAL_EFFECTIVE_DATE = "2026-09-20";
export const LEGAL_EFFECTIVE_AT = `${LEGAL_EFFECTIVE_DATE}T00:00:00+09:00`;

export const LEGAL_DOCUMENT_VERSION = {
  terms: LEGAL_EFFECTIVE_DATE,
  privacyNotice: LEGAL_EFFECTIVE_DATE,
  ageEligibility: LEGAL_EFFECTIVE_DATE,
} as const;

export const PREVIOUS_LEGAL_DOCUMENT_VERSION = "2026-03-24";

export const LEGAL_CONTACT = {
  department: "딱다구리 개발팀",
  email: "woodpecker.dev.team@gmail.com",
} as const;

export function isLegalRevisionEffective(now = new Date()): boolean {
  return now.getTime() >= new Date(LEGAL_EFFECTIVE_AT).getTime();
}

export function formatLegalDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}
