import { createAdminClient } from "@/lib/supabase/admin";

import { OTP_GENERATE_LINK_TIMEOUT_MS } from "../constants/otp";

export type OtpIssueClient = ReturnType<typeof createAdminClient>;

/**
 * 신규 Signup OTP Issue 요청.
 *
 * 신규 사용자는 generateLink(type: "signup")이 사용자 생성과 OTP 발급을 함께 수행하므로
 * password와 profile trigger에 필요한 metadata를 같이 전달한다.
 */
export type NewUserSignupOtpIssueRequest = {
  email: string;
  purpose: "signup";
  signupMode: "new-user";
  password: string;
  metadata: {
    nickname: string;
    canonical_email: string;
  };
};

/**
 * 기존 사용자 Signup OTP Issue 요청.
 *
 * 기존 사용자는 사용자 생성 없이 magiclink OTP만 재발급한다.
 */
export type ExistingUserSignupOtpIssueRequest = {
  email: string;
  purpose: "signup";
  signupMode: "existing-user";
};

/**
 * 비밀번호 재설정 OTP Issue 요청.
 */
export type ResetPasswordOtpIssueRequest = {
  email: string;
  purpose: "reset-password";
};

/**
 * OTP Issue Provider 요청 입력.
 *
 * 같은 signup purpose 안에서도 신규 사용자와 기존 사용자의
 * Supabase generateLink type이 다르므로 discriminated union으로 구분한다.
 */
export type OtpIssueRequest =
  | NewUserSignupOtpIssueRequest
  | ExistingUserSignupOtpIssueRequest
  | ResetPasswordOtpIssueRequest;

/**
 * 준비된 OTP Issue client를 포함한 Provider 호출 입력.
 */
export type IssueOtpInput =
  | (NewUserSignupOtpIssueRequest & { client: OtpIssueClient })
  | (ExistingUserSignupOtpIssueRequest & { client: OtpIssueClient })
  | (ResetPasswordOtpIssueRequest & { client: OtpIssueClient });

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
 * OTP Issue 전용 Supabase Admin client를 준비한다.
 *
 * 실제 Provider operation은 시작하지 않으며,
 * generateLink 호출에 사용할 timeout-enabled fetch만 설정한다.
 *
 * OTP Issue Rate Limit caller는 tryStartIssue() 전에 이 client를 준비하고,
 * 허용된 직후 issueOtp()를 호출한다.
 *
 * @returns OTP Issue 전용 Supabase Admin client
 */
export function createOtpIssueClient(): OtpIssueClient {
  return createAdminClient({
    fetch: otpProviderFetch,
  });
}

/**
 * OTP 발급 공통 함수.
 *
 * Provider mapping:
 * - signup + new-user      → signup
 * - signup + existing-user → magiclink
 * - reset-password          → recovery
 *
 * 신규 Signup은 generateLink(type: "signup")이 사용자 생성까지 담당하므로
 * 상위 계층에서 약관 저장에 필요한 최소 정보인 userId도 반환한다.
 *
 * @param input OTP 발급 요청과 준비된 OTP Issue client
 * @returns OTP properties, 최소 user identity, Provider error
 */
export async function issueOtp(input: IssueOtpInput) {
  if (input.purpose === "reset-password") {
    const { data, error } = await input.client.auth.admin.generateLink({
      email: input.email,
      type: "recovery",
    });

    return {
      otp: data.properties ?? null,
      userId: data.user?.id ?? null,
      error,
    };
  }

  if (input.signupMode === "new-user") {
    const { data, error } = await input.client.auth.admin.generateLink({
      email: input.email,
      password: input.password,
      type: "signup",
      options: {
        data: input.metadata,
      },
    });

    return {
      otp: data.properties ?? null,
      userId: data.user?.id ?? null,
      error,
    };
  }

  const { data, error } = await input.client.auth.admin.generateLink({
    email: input.email,
    type: "magiclink",
  });

  return {
    otp: data.properties ?? null,
    userId: data.user?.id ?? null,
    error,
  };
}
