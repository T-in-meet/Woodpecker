import { describe, expect, it } from "vitest";

import {
  API_RESULTS,
  type ApiCode,
  makeApiCode,
} from "@/lib/constants/apiCodes";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { failureResponse, successResponse } from "./response";

describe("api response contract", () => {
  it("successResponse: success/code/data envelope과 기본 status 매핑을 보장한다", async () => {
    const code = makeApiCode("signup", API_RESULTS.SUCCESS);
    const response = successResponse(code, { redirectTo: "/resend-email" });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      code: "SIGNUP_SUCCESS",
      data: { redirectTo: "/resend-email" },
    });
  });

  it("failureResponse: success/code/data.errors envelope과 INVALID_INPUT status 매핑을 보장한다", async () => {
    const code = makeApiCode("signup", API_RESULTS.INVALID_INPUT);
    const response = failureResponse(code, {
      errors: [{ field: "email", reason: VALIDATION_REASON.INVALID_FORMAT }],
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      success: false,
      code: "SIGNUP_INVALID_INPUT",
      data: {
        errors: [{ field: "email", reason: VALIDATION_REASON.INVALID_FORMAT }],
      },
    });
  });

  it("failureResponse: errors가 없으면 data는 null 계약을 유지한다", async () => {
    const response = failureResponse(
      makeApiCode("signup", API_RESULTS.INTERNAL_ERROR),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      code: "SIGNUP_INTERNAL_ERROR",
      data: null,
    });
  });

  it("status override는 suffix 매핑보다 우선한다 (success/failure 공통)", async () => {
    const success = successResponse(
      makeApiCode("signup", API_RESULTS.SUCCESS),
      { ok: true },
      { status: 201 },
    );
    const failure = failureResponse(
      makeApiCode("signup", API_RESULTS.INVALID_INPUT),
      { status: 422 },
    );

    expect(success.status).toBe(201);
    expect(failure.status).toBe(422);
  });

  it("알 수 없는 code suffix는 fallback status 500을 사용한다", async () => {
    const response = successResponse("AUTH_UNKNOWN" as ApiCode, {
      passthrough: true,
    });

    expect(response.status).toBe(500);
  });

  it("message는 선택 필드이며 contract 핵심(success/code/data/status)과 독립적으로 동작한다", async () => {
    const response = successResponse(
      makeApiCode("signup", API_RESULTS.SUCCESS),
      { redirectTo: "/resend-email" },
      { message: "optional message" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe("SIGNUP_SUCCESS");
    expect(body.data).toEqual({ redirectTo: "/resend-email" });
    expect(typeof body.message).toBe("string");
  });
});
