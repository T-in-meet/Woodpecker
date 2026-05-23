type OtpEmailTemplateProps = {
  otp: string;
};

/**
 * OTP 이메일 템플릿
 *
 * 사용자에게 전달할 OTP 인증 번호를
 * 이메일 본문 형태로 렌더링한다.
 *
 * 현재 템플릿은 signup / reset-password 목적을
 * 구분하지 않는 공통 OTP UI를 사용한다.
 *
 * 주의:
 * - 이메일 제목(subject) 분기는 sendOtpEmail 계층에서 처리한다.
 * - 본 템플릿은 OTP 표시 역할만 담당한다.
 */
export function OtpEmailTemplate({ otp }: OtpEmailTemplateProps) {
  return (
    <div>
      {/* 사용자에게 표시할 OTP 제목 */}
      <p>인증 번호</p>

      {/* 실제 인증에 사용할 OTP 코드 */}
      <p>{otp}</p>
    </div>
  );
}
