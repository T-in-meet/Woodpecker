import { APIRequestContext, expect, test } from "@playwright/test";

import { ROUTES } from "@/lib/constants/routes";

const SIGNUP_ENDPOINT = "/api/auth/signup";
const SIGNUP_SUCCESS_CODE = "SIGNUP_SUCCESS";
const SIGNUP_INTERNAL_ERROR_CODE = "SIGNUP_INTERNAL_ERROR";

type SignupResponse = {
  success: boolean;
  code: string;
  data: Record<string, unknown> | null;
};

async function postSignup(
  request: APIRequestContext,
  email: string,
  ip: string,
) {
  return request.post(SIGNUP_ENDPOINT, {
    headers: {
      "x-forwarded-for": ip,
    },
    data: {
      email,
      password: "Password123!",
      nickname: "tester",
      agreements: {
        age14OrOlder: true,
        privacyPolicyAcknowledged: true,
        termsOfService: true,
      },
    },
  });
}

test.describe("Auth external-observable regression", () => {
  test("TC-01: signup 존재/비존재 이메일 요청의 외부 observable(status/code/success/data shape)은 동일하다", async ({
    request,
  }) => {
    const existingRes = await postSignup(
      request,
      "existing@example.com",
      "10.200.0.1",
    );
    const newRes = await postSignup(request, "new@example.com", "10.200.0.2");

    const existingBody = (await existingRes.json()) as SignupResponse;
    const newBody = (await newRes.json()) as SignupResponse;

    expect(existingRes.status()).toBe(newRes.status());
    expect(existingBody.code).toBe(newBody.code);
    expect(existingBody.success).toBe(newBody.success);

    expect(existingBody.data).not.toBeNull();
    expect(newBody.data).not.toBeNull();

    const existingDataKeys = Object.keys(existingBody.data ?? {}).sort();
    const newDataKeys = Object.keys(newBody.data ?? {}).sort();
    expect(existingDataKeys).toEqual(newDataKeys);
  });

  test("TC-02: signup 유효 payload 응답은 현재 계약(success 또는 internal_error envelope)을 유지한다", async ({
    request,
  }) => {
    const response = await postSignup(
      request,
      "shape-check@example.com",
      "10.200.0.3",
    );
    const body = (await response.json()) as SignupResponse;

    expect(typeof body.success).toBe("boolean");
    expect(typeof body.code).toBe("string");

    if (body.success) {
      expect(body.code).toBe(SIGNUP_SUCCESS_CODE);
      expect(body.data).not.toBeNull();
      expect(typeof body.data?.email).toBe("string");

      const redirectTo = body.data?.redirectTo;

      expect(typeof redirectTo).toBe("string");

      const redirectUrl = new URL(
        redirectTo as string,
        "http://localhost:3000",
      );

      expect(redirectUrl.pathname).toBe(ROUTES.VERIFY_OTP);
      expect(redirectUrl.searchParams.get("purpose")).toBe("signup");
      expect(redirectUrl.searchParams.get("email")).toBe(
        "shape-check@example.com",
      );

      return;
    }

    expect(body.code).toBe(SIGNUP_INTERNAL_ERROR_CODE);
    expect(body.data).toBeNull();
  });
});
