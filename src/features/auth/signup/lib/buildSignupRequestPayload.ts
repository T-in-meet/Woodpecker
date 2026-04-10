/**
 * 회원가입 폼에서 사용하는 입력 값 타입 (API 전달용)
 *
 * - agreements: 약관 동의 (nested 구조)
 * - avatarFile: 선택적 파일 (이미지 업로드)
 */
type SignupFormValues = {
  email: string;
  password: string;
  nickname: string;
  agreements: {
    termsOfService: boolean;
    privacyPolicy: boolean;
  };
  avatarFile?: File | null;
};

/**
 * API 요청 payload 타입 (discriminated union)
 *
 * - requestType을 기준으로 분기 처리
 *   1. json: 일반 요청 (파일 없음)
 *   2. multipart: 파일 포함 요청
 *
 * 설계 이유:
 * - fetch 호출 시 Content-Type 처리 분기 필요
 * - 타입 레벨에서 안전하게 분기 강제
 */
type SignupRequestPayload =
  | {
      requestType: "json";
      body: {
        email: string;
        password: string;
        nickname: string;
        agreements: {
          termsOfService: boolean;
          privacyPolicy: boolean;
        };
      };
    }
  | {
      requestType: "multipart";
      body: FormData;
    };

/**
 * 회원가입 요청 payload 생성 함수
 *
 * 역할:
 * - 폼 입력값 → API 요청 형태로 변환
 * - avatarFile 존재 여부에 따라 JSON / multipart 자동 분기
 *
 * @param input 폼 입력값
 * @returns SignupRequestPayload (json | multipart)
 *
 * ⚠️ 주의사항:
 * - multipart 요청 시 agreements는 JSON.stringify 필요
 *   → FormData는 객체를 직접 담을 수 없음
 */
export function buildSignupRequestPayload(
  input: SignupFormValues,
): SignupRequestPayload {
  const { email, password, nickname, agreements, avatarFile } = input;

  /**
   * 파일이 존재하는 경우 → multipart/form-data
   */
  if (avatarFile instanceof File) {
    const formData = new FormData();

    formData.append("email", email);
    formData.append("password", password);
    formData.append("nickname", nickname);

    /**
     * 객체는 문자열로 직렬화해서 저장
     */
    formData.append("agreements", JSON.stringify(agreements));

    /**
     * 파일 첨부
     */
    formData.append("avatarFile", avatarFile);

    return { requestType: "multipart", body: formData };
  }

  /**
   * 파일이 없는 경우 → application/json
   */
  return {
    requestType: "json",
    body: { email, password, nickname, agreements },
  };
}
