import { APIRequestContext, expect, test } from "@playwright/test";

const SIGNUP_ENDPOINT = "/api/auth/signup";
const CALLBACK_ENDPOINT = "/api/auth/callback";
const SIGNUP_SUCCESS_CODE = "SIGNUP_SUCCESS";
const SIGNUP_REDIRECT_TO = "/verify-email";
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
        termsOfService: true,
        privacyPolicy: true,
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
      expect(body.data?.redirectTo).toBe(SIGNUP_REDIRECT_TO);
      return;
    }

    expect(body.code).toBe(SIGNUP_INTERNAL_ERROR_CODE);
    expect(body.data).toBeNull();
  });

  test("TC-03: callback(token_hash/type) 요청은 현재 계약대로 redirect observable(status/location)을 반환한다", async ({
    request,
  }) => {
    const response = await request.get(
      `${CALLBACK_ENDPOINT}?token_hash=dummy&type=magiclink`,
      {
        maxRedirects: 0,
      },
    );
    const headers = response.headers();

    expect(response.status()).toBe(307);
    expect(headers.location).toBeTruthy();
    expect(headers.location).toContain("/verify-email");
  });

  test("TC-04: callback 실패 케이스(token_hash=dummy vs invalid)는 외부 observable이 동일하다", async ({
    request,
  }) => {
    const dummyResponse = await request.get(
      `${CALLBACK_ENDPOINT}?token_hash=dummy&type=magiclink`,
      {
        maxRedirects: 0,
      },
    );
    const invalidResponse = await request.get(
      `${CALLBACK_ENDPOINT}?token_hash=invalid&type=magiclink`,
      {
        maxRedirects: 0,
      },
    );

    expect(dummyResponse.status()).toBe(invalidResponse.status());
    expect(dummyResponse.headers().location).toBe(
      invalidResponse.headers().location,
    );
  });
});
