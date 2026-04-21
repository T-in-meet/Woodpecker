import { loginSuccessResponseSchema } from "../schema/loginSuccessResponseSchema";

type LoginPayload = {
  email: string;
  password: string;
  redirectTo?: string;
};

export type LoginSuccessResponse = {
  data: {
    redirectTo: string;
  };
};

export async function loginMutation(
  payload: LoginPayload,
): Promise<LoginSuccessResponse> {
  const { email, password, redirectTo } = payload;

  // redirect query가 있을 때만 URL에 포함 — 없는 경우 불필요한 query 생성 방지
  const url = redirectTo
    ? `/api/auth/login?redirect=${encodeURIComponent(redirectTo)}`
    : "/api/auth/login";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const body = await response.json();

  // 서버 실패 응답 body를 그대로 reject — 계약 필드(code, data.errors 등) 손실 방지
  if (!response.ok) {
    throw body;
  }

  return loginSuccessResponseSchema.parse(body);
}
