import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

import { POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/auth/oauth/agreement-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("OAuth agreement intent route", () => {
  it("약관과 개인정보에 모두 동의하면 intent cookie를 설정한다", async () => {
    const response = await POST(
      makeRequest({
        agreements: {
          termsOfService: true,
          privacyPolicyAcknowledged: true,
          age14OrOlder: true,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe(AUTH_API_CODES.OAUTH_AGREEMENT_INTENT_SUCCESS);
    expect(response.headers.get("set-cookie")).toContain(
      "oauth_agreement_intent=accepted",
    );
  });

  it("필수 동의가 누락되면 validation 실패를 반환한다", async () => {
    const response = await POST(
      makeRequest({
        agreements: {
          termsOfService: true,
          privacyPolicyAcknowledged: false,
          age14OrOlder: true,
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe(AUTH_API_CODES.OAUTH_AGREEMENT_INTENT_INVALID_INPUT);
  });
});
