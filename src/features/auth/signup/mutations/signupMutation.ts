import { requestAuthApi } from "@/features/auth/lib/requestAuthApi";

import { signupSuccessResponseSchema } from "../schema/signupSuccessResponseSchema";

// 회원가입 요청 시 사용하는 payload 타입
type SignupPayload = {
  email: string;
  password: string;
  nickname: string;
  agreements: {
    termsOfService: boolean;
    privacyPolicyAcknowledged: boolean;
    age14OrOlder: boolean;
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
  // HTTP 레벨 실패(400, 422, 500 등)는 서버 계약 body가 그대로 reject되고,
  // 오프라인·응답 없음 같은 transport 실패는 GlobalError로 좁혀져서 올라온다.
  const body = await requestAuthApi("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  return signupSuccessResponseSchema.parse(body);
}
