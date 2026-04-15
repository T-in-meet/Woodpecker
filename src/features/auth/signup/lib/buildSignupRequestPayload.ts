/**
 * 회원가입 폼에서 사용하는 입력 값 타입 (API 전달용)
 *
 * - agreements: 약관 동의 (nested 구조)
 */
type SignupFormValues = {
  email: string;
  password: string;
  nickname: string;
  agreements: {
    termsOfService: boolean;
    privacyPolicy: boolean;
  };
};

/**
 * 회원가입 요청 payload 생성 함수
 *
 * 역할:
 * - 폼 입력값 → API 요청 형태로 변환
 *
 * @param input 폼 입력값
 * @returns JSON body
 */
export function buildSignupRequestPayload(input: SignupFormValues) {
  const { email, password, nickname, agreements } = input;

  return { email, password, nickname, agreements };
}
