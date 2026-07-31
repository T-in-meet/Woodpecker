import { createClient } from "@/lib/supabase/server";

import { OTP_PURPOSE_TO_SUPABASE_TYPE, OtpPurpose } from "../../constants/otp";

type VerifyOtp = {
  email: string;
  otp: string;
  purpose: OtpPurpose;
};

/**
 * Supabase OTP 인증 검증 함수.
 *
 * 서비스 내부 OTP 목적(purpose)을
 * Supabase OTP 타입(magiclink, recovery)으로 변환한 뒤
 * verifyOtp를 수행한다.
 *
 * 역할:
 * - OTP 목적 -> Supabase 타입 매핑
 * - Supabase verifyOtp 호출
 *
 * 주의:
 * - 입력값 검증은 action/schema 계층에서 처리한다.
 * - logging 및 상태 분기 처리도 action 계층에서 수행한다.
 * - 해당 함수는 Supabase verifyOtp 결과를 그대로 반환한다.
 */
export const verifyOtp = async ({ email, otp, purpose }: VerifyOtp) => {
  const supabase = await createClient();

  return await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: OTP_PURPOSE_TO_SUPABASE_TYPE[purpose],
  });
};
