import { createAdminClient } from "@/lib/supabase/admin";

import { AGREEMENT_REQUIRED_PATH } from "../constants/agreementRequired";

export const AGREEMENT_REQUIRED_REDIRECT = AGREEMENT_REQUIRED_PATH;

type AgreementSource = "email" | "oauth" | "email_backfill";

export async function hasUserAgreement(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("user_agreements")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

export async function upsertUserAgreement(
  userId: string,
  source: AgreementSource,
): Promise<void> {
  const adminClient = createAdminClient();
  const agreedAt = new Date().toISOString();

  const { error } = await adminClient.from("user_agreements").upsert(
    {
      user_id: userId,
      terms_agreed_at: agreedAt,
      privacy_agreed_at: agreedAt,
      source,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }
}

/**
 * 약관 동의 행이 없으면 생성하고, 이미 있으면 최초 source를 보존합니다.
 */
export async function ensureUserAgreement(
  userId: string,
  source: AgreementSource,
): Promise<void> {
  const adminClient = createAdminClient();
  const agreedAt = new Date().toISOString();

  const { error } = await adminClient.from("user_agreements").upsert(
    {
      user_id: userId,
      terms_agreed_at: agreedAt,
      privacy_agreed_at: agreedAt,
      source,
    },
    {
      ignoreDuplicates: true,
      onConflict: "user_id",
    },
  );

  if (error) {
    throw error;
  }
}
