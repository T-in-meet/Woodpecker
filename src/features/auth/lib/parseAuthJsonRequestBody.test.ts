import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  AuthJsonParseError,
  parseAuthJsonRequestBody,
} from "@/features/auth/lib/parseAuthJsonRequestBody";

function createJsonRequest(
  body: string,
  contentType = "application/json",
): NextRequest {
  return new Request("http://localhost/api/auth/test", {
    method: "POST",
    headers: {
      "content-type": contentType,
    },
    body,
  }) as unknown as NextRequest;
}

async function expectAuthJsonParseError(request: NextRequest) {
  try {
    await parseAuthJsonRequestBody(request);
    throw new Error("Expected AuthJsonParseError to be thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(AuthJsonParseError);
  }
}

describe("parseAuthJsonRequestBody contract", () => {
  it("정상적인 JSON body를 주면 파싱 결과를 그대로 반환한다", async () => {
    const request = createJsonRequest(
      '{"email":"test@example.com","agreements":{"termsOfService":true}}',
    );

    await expect(parseAuthJsonRequestBody(request)).resolves.toEqual({
      email: "test@example.com",
      agreements: { termsOfService: true },
    });
  });

  it("malformed JSON body면 AuthJsonParseError를 던진다", async () => {
    const request = createJsonRequest("{");

    await expectAuthJsonParseError(request);
  });

  it("빈 body는 현재 계약대로 AuthJsonParseError를 던진다", async () => {
    const request = createJsonRequest("");

    await expectAuthJsonParseError(request);
  });

  it("non-JSON 입력은 현재 계약대로 AuthJsonParseError를 던진다", async () => {
    const request = createJsonRequest("hello", "text/plain");

    await expectAuthJsonParseError(request);
  });

  it("invalid format 입력은 현재 계약대로 AuthJsonParseError를 던진다", async () => {
    const request = createJsonRequest(
      "email=test@example.com&nickname=tester",
      "application/x-www-form-urlencoded",
    );

    await expectAuthJsonParseError(request);
  });
});
