import { buildSignupRequestPayload } from "../lib/buildSignupRequestPayload";
import { signupSuccessResponseSchema } from "../schema/signupSuccessResponseSchema";

// 회원가입 요청 시 사용하는 payload 타입
type SignupPayload = {
  email: string;
  password: string;
  nickname: string;
  agreements: {
    termsOfService: boolean;
    privacyPolicy: boolean;
  };
  avatarFile?: File | null;
};

// 회원가입 성공 시 서버에서 반환하는 응답 타입
export type SignupSuccessResponse = {
  data: {
    email: string;
    redirectTo: string;
  };
};

// 회원가입 mutation 함수
// 역할:
// 1. payload를 서버 요청 형태로 변환
// 2. API 호출 (fetch)
// 3. 응답 반환 또는 에러 throw
export async function signupMutation(
  payload: SignupPayload,
): Promise<SignupSuccessResponse> {
  // payload를 JSON 또는 multipart 형태로 변환
  // (이미지 포함 여부 등에 따라 분기됨)
  const request = buildSignupRequestPayload(payload);

  // 회원가입 API 요청
  const response = await fetch("/api/auth/signup", {
    method: "POST",

    // JSON 요청인 경우: Content-Type 설정 + 문자열 직렬화
    ...(request.requestType === "json"
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request.body),
        }
      : // multipart 요청인 경우: FormData 그대로 전달
        // (Content-Type은 브라우저가 자동으로 boundary 포함하여 설정)
        { body: request.body }),
  });

  // 성공/실패 분기 전에 body를 먼저 파싱
  const body = await response.json();

  // HTTP 레벨 실패 처리 (예: 400, 422, 500 등)
  // 서버 실패 응답 body를 그대로 reject — 계약 필드(code, data.errors 등) 손실 방지
  if (!response.ok) {
    throw body;
  }

  return signupSuccessResponseSchema.parse(body);
}
