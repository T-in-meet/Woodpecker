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
  // payload를 JSON body 형태로 변환
  const { email, password, nickname, agreements } = payload;
  const requestBody = { email, password, nickname, agreements };

  // 회원가입 API 요청
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
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
