/**
 * 서비스 내부 OTP 인증 목적.
 *
 * signup:
 * - 회원가입 이메일 인증 흐름
 *
 * reset-password:
 * - 비밀번호 재설정 인증 흐름
 * - verifyOtp 성공 이후 reset-password 페이지로 연결된다.
 */
export type OtpPurpose = "signup" | "reset-password";

/**
 * Supabase OTP 인증 타입.
 *
 * magiclink:
 * - 회원가입 이메일 인증에 사용
 *
 * recovery:
 * - 비밀번호 재설정(recovery) 인증에 사용
 */
export type SupabaseOtpType = "magiclink" | "recovery";
