import { createAdminClient } from "@/lib/supabase/admin";

import { OTP_PURPOSE_TO_SUPABASE_TYPE } from "../constants/otp";
import { OtpPurpose } from "../types/otp";

type IssueOtpProps = {
  email: string;
  purpose: OtpPurpose;
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
  const adminClient = createAdminClient();

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
