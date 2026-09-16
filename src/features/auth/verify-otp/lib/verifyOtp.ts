import { createClient } from "@/lib/supabase/server";

import {
  OTP_PURPOSE_TO_SUPABASE_VERIFY_TYPE,
  OtpPurpose,
} from "../../constants/otp";

type VerifyOtp = {
  email: string;
  otp: string;
  purpose: OtpPurpose;
};

/**
 * Supabase OTP 인증 검증 함수.
 *
 * 서비스 내부 OTP 목적(purpose)을 Supabase verifyOtp 타입으로 변환한 뒤
 * verifyOtp를 수행한다.
 *
 * Signup Issue는 신규 사용자에서 signup, 기존 사용자에서 magiclink를 사용하지만
 * Verify는 두 token을 모두 처리할 수 있는 email 타입으로 통일한다.
 *
 * 역할:
 * - OTP 목적 -> Supabase Verify 타입 매핑
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
    type: OTP_PURPOSE_TO_SUPABASE_VERIFY_TYPE[purpose],
  });
};
