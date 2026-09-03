import { requestAuthApi } from "@/features/auth/lib/requestAuthApi";

import {
  LoginSuccessResponse,
  loginSuccessResponseSchema,
} from "../schema/loginSuccessResponseSchema";

export type LoginPayload = {
  email: string;
  password: string;
};

export async function loginMutation(
  payload: LoginPayload,
  redirect?: string,
): Promise<LoginSuccessResponse> {
  const { email, password } = payload;

  // redirect query가 있을 때만 URL에 포함 — 없는 경우 불필요한 query 생성 방지
  const url = redirect
    ? `/api/auth/login?redirect=${encodeURIComponent(redirect)}`
    : "/api/auth/login";

  // 서버 실패 응답 body는 그대로 reject되고(계약 필드 손실 방지),
  // 오프라인·응답 없음 같은 transport 실패는 GlobalError로 좁혀져서 올라온다.
  const body = await requestAuthApi(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  return loginSuccessResponseSchema.parse(body);
}
