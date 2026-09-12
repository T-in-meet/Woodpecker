import {
  isLegalRevisionEffective,
  LEGAL_DOCUMENT_VERSION,
} from "@/lib/constants/legal";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  AGREEMENT_REQUIRED_PATH,
  getAgreementRequiredPath,
} from "../constants/agreementRequired";
import { validateRedirectPath } from "./validateRedirectPath";

export const AGREEMENT_REQUIRED_REDIRECT = AGREEMENT_REQUIRED_PATH;

export const LEGAL_ACCEPTANCE_EVENT = {
  terms: "terms_accepted",
  privacyNotice: "privacy_notice_acknowledged",
  ageEligibility: "age_14_confirmed",
} as const;

export type LegalAcceptanceEvent =
  (typeof LEGAL_ACCEPTANCE_EVENT)[keyof typeof LEGAL_ACCEPTANCE_EVENT];

export type LegalAcceptanceSource =
  | "email"
  | "oauth"
  | "email_backfill"
  | "agreements_page";

const CURRENT_REQUIREMENTS = [
  {
    eventType: LEGAL_ACCEPTANCE_EVENT.terms,
    documentVersion: LEGAL_DOCUMENT_VERSION.terms,
  },
  {
    eventType: LEGAL_ACCEPTANCE_EVENT.privacyNotice,
    documentVersion: LEGAL_DOCUMENT_VERSION.privacyNotice,
  },
  {
    eventType: LEGAL_ACCEPTANCE_EVENT.ageEligibility,
    documentVersion: LEGAL_DOCUMENT_VERSION.ageEligibility,
  },
] as const;

export type LegalAcceptanceStatus = {
  canAccessService: boolean;
  hasAcceptanceHistory: boolean;
  isComplete: boolean;
  isEnforced: boolean;
  missingEvents: LegalAcceptanceEvent[];
};

function requirementKey(eventType: string, documentVersion: string) {
  return `${eventType}:${documentVersion}`;
}

export async function getLegalAcceptanceStatus(
  userId: string,
  now = new Date(),
): Promise<LegalAcceptanceStatus> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("user_legal_acceptances")
    .select("event_type, document_version")
    .eq("user_id", userId)
    .in(
      "event_type",
      CURRENT_REQUIREMENTS.map(({ eventType }) => eventType),
    );

  if (error) throw error;

  const acceptanceRows = data ?? [];

  const accepted = new Set(
    acceptanceRows.map(({ event_type, document_version }) =>
      requirementKey(event_type, document_version),
    ),
  );

  const missingEvents = CURRENT_REQUIREMENTS.filter(
    ({ eventType, documentVersion }) =>
      !accepted.has(requirementKey(eventType, documentVersion)),
  ).map(({ eventType }) => eventType);

  const isComplete = missingEvents.length === 0;
  const isEnforced = isLegalRevisionEffective(now);

  /**
   * 현재 버전 여부와 관계없이 법적 동의 이벤트가 하나라도 존재하는지 나타낸다.
   *
   * 개정 약관 시행 전 유예 여부와는 별개의 값이다.
   * OAuth login callback에서는 정상적인 기존 가입자와
   * 로그인 경로에서 새로 생성된 사용자를 구분하는 데 사용한다.
   */
  const hasAcceptanceHistory = acceptanceRows.length > 0;

  return {
    // 기존 개정 약관 유예 정책은 유지한다.
    canAccessService: !isEnforced || isComplete,
    hasAcceptanceHistory,
    isComplete,
    isEnforced,
    missingEvents,
  };
}

export async function hasCurrentLegalAcceptance(
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const status = await getLegalAcceptanceStatus(userId, now);
  return status.canAccessService;
}

export async function getLegalAcceptanceRequiredPath(
  userId: string,
  redirectPath?: string | null,
): Promise<string | null> {
  // 개정 약관 시행 전에는 기존 정책대로 재동의를 강제하지 않는다.
  if (!isLegalRevisionEffective()) return null;

  const status = await getLegalAcceptanceStatus(userId);

  if (status.canAccessService) return null;

  return getAgreementRequiredPath(validateRedirectPath(redirectPath ?? null));
}

export async function recordCurrentLegalAcceptances(
  userId: string,
  source: LegalAcceptanceSource,
): Promise<void> {
  const adminClient = createAdminClient();
  const occurredAt = new Date().toISOString();

  const rows = CURRENT_REQUIREMENTS.map(({ eventType, documentVersion }) => ({
    document_version: documentVersion,
    event_type: eventType,
    occurred_at: occurredAt,
    source,
    user_id: userId,
  }));

  const { error } = await adminClient
    .from("user_legal_acceptances")
    .upsert(rows, {
      ignoreDuplicates: true,
      onConflict: "user_id,event_type,document_version",
    });

  if (error) throw error;
}

/** @deprecated 신규 코드는 getLegalAcceptanceStatus를 사용합니다. */
export async function hasUserAgreement(userId: string): Promise<boolean> {
  return hasCurrentLegalAcceptance(userId);
}

/** @deprecated 신규 코드는 recordCurrentLegalAcceptances를 사용합니다. */
export async function upsertUserAgreement(
  userId: string,
  source: LegalAcceptanceSource,
): Promise<void> {
  await recordCurrentLegalAcceptances(userId, source);
}

/** @deprecated 신규 코드는 recordCurrentLegalAcceptances를 사용합니다. */
export async function ensureUserAgreement(
  userId: string,
  source: LegalAcceptanceSource,
): Promise<void> {
  await recordCurrentLegalAcceptances(userId, source);
}
