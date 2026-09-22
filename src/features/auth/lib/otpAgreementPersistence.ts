import { recordCurrentLegalAcceptances } from "@/features/auth/lib/userAgreements";

export const OTP_AGREEMENT_PERSISTENCE_TIMEOUT_MS = 10_000;

export class OtpAgreementPersistenceTimeoutError extends Error {
  constructor() {
    super("OTP agreement persistence timed out");
    this.name = "OtpAgreementPersistenceTimeoutError";
  }
}

/**
 * OTP Issue의 agreement persistence 경로에만 10초 bounded-settle을 적용한다.
 * 일반 agreements page에서 사용하는 recordCurrentLegalAcceptances 기본 계약은 변경하지 않는다.
 */
export async function recordOtpAgreementLegalAcceptances(
  userId: string,
): Promise<void> {
  const signal = AbortSignal.timeout(OTP_AGREEMENT_PERSISTENCE_TIMEOUT_MS);

  try {
    await recordCurrentLegalAcceptances(userId, "email", { signal });
  } catch (error) {
    if (signal.aborted) {
      throw new OtpAgreementPersistenceTimeoutError();
    }

    throw error;
  }
}
