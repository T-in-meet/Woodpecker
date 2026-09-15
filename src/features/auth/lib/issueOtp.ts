import { createAdminClient } from "@/lib/supabase/admin";

import {
  OTP_GENERATE_LINK_TIMEOUT_MS,
  OTP_PURPOSE_TO_SUPABASE_TYPE,
  OtpPurpose,
} from "../constants/otp";

type IssueOtpProps = {
  email: string;
  purpose: OtpPurpose;
};

/**
 * OTP generateLink 요청에 timeout cancellation을 추가한다.
 *
 * 기존 fetch cancellation이 있으면 유지하면서 OTP 전용 timeout signal을 합성한다.
 * RequestInit.signal이 명시된 경우 Request.signal보다 우선한다.
 */
const otpProviderFetch: typeof fetch = (input, init) => {
  const timeoutSignal = AbortSignal.timeout(OTP_GENERATE_LINK_TIMEOUT_MS);

  let existingSignal: AbortSignal | undefined;

  if (init?.signal !== undefined) {
    existingSignal = init.signal ?? undefined;
  } else if (input instanceof Request) {
    existingSignal = input.signal;
  }

  const signal = existingSignal
    ? AbortSignal.any([existingSignal, timeoutSignal])
    : timeoutSignal;

  return fetch(input, {
    ...init,
    signal,
  });
};

/**
 * OTP 발급 공통 함수
 *
 * 프로젝트의 OTP purpose(signup, recovery)를 기반으로
 * Supabase OTP를 발급한다.
 *
 * route 계층이 Supabase OTP type(magiclink, recovery)에
 * 직접 의존하지 않도록 purpose → type 매핑을 내부에서 처리한다.
 *
 * 반환값의 otp에는 email_otp, hashed_token, action_link 등
 * generateLink 결과 properties가 포함된다.
 */
export async function issueOtp(input: IssueOtpProps) {
  const adminClient = createAdminClient({
    fetch: otpProviderFetch,
  });

  // 프로젝트의 OTP purpose를 Supabase OTP type으로 변환한다.
  // route 계층이 Supabase 구현 세부사항에 직접 의존하지 않도록 캡슐화한다.
  const { data, error } = await adminClient.auth.admin.generateLink({
    email: input.email,
    type: OTP_PURPOSE_TO_SUPABASE_TYPE[input.purpose],
  });

  return {
    // 실제 호출부에서 필요한 값(email_otp, hashed_token, action_link 등)은
    // generateLink의 properties 내부에 포함되어 있다.
    otp: data.properties ?? null,
    error,
  };
}
