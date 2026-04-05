import { describe, expect, it } from "vitest";

import { buildSignupRequestPayload } from "./buildSignupRequestPayload";

const validInput = {
  email: "test@example.com",
  password: "12345678",
  confirmPassword: "12345678",
  nickname: "tester",
  agreements: {
    termsOfService: true,
    privacyPolicy: true,
  },
};

describe("buildSignupRequestPayload", () => {
  it("TC-01: avatarFile이 없으면 JSON payload를 생성한다", () => {
    const result = buildSignupRequestPayload({ ...validInput });

    expect(result.requestType).toBe("json");
    expect(result.body).not.toBeInstanceOf(FormData);

    const body = result.body as Record<string, unknown>;
    expect(body).toHaveProperty("email", validInput.email);
    expect(body).toHaveProperty("password", validInput.password);
    expect(body).toHaveProperty("nickname", validInput.nickname);
    expect(body).toHaveProperty("agreements", validInput.agreements);
    expect(body).not.toHaveProperty("confirmPassword");
  });

  it("TC-02: avatarFile이 null이면 JSON payload를 생성한다", () => {
    const result = buildSignupRequestPayload({
      ...validInput,
      avatarFile: null,
    });

    expect(result.requestType).toBe("json");
    expect(result.body).not.toBeInstanceOf(FormData);
  });

  it("TC-03: avatarFile이 File 인스턴스이면 multipart payload를 생성한다", () => {
    const file = new File(["content"], "avatar.png", { type: "image/png" });
    const result = buildSignupRequestPayload({
      ...validInput,
      avatarFile: file,
    });

    expect(result.requestType).toBe("multipart");
    expect(result.body).toBeInstanceOf(FormData);
  });

  it("TC-04: multipart payload는 agreements를 JSON 문자열로 직렬화한다", () => {
    const file = new File(["content"], "avatar.png", { type: "image/png" });
    const result = buildSignupRequestPayload({
      ...validInput,
      avatarFile: file,
    });

    const formData = result.body as FormData;
    const agreements = formData.get("agreements");

    expect(typeof agreements).toBe("string");
    expect(JSON.parse(agreements as string)).toEqual({
      termsOfService: true,
      privacyPolicy: true,
    });
  });

  it("TC-05: multipart payload는 avatarFile을 그대로 포함한다", () => {
    const file = new File(["content"], "avatar.png", { type: "image/png" });
    const result = buildSignupRequestPayload({
      ...validInput,
      avatarFile: file,
    });

    const formData = result.body as FormData;
    expect(formData.get("avatarFile")).toBe(file);
  });

  it("TC-06: JSON / multipart 모두 confirmPassword을 포함하지 않는다", () => {
    const jsonResult = buildSignupRequestPayload({ ...validInput });
    const body = jsonResult.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("confirmPassword");

    const file = new File(["content"], "avatar.png", { type: "image/png" });
    const multipartResult = buildSignupRequestPayload({
      ...validInput,
      avatarFile: file,
    });
    const formData = multipartResult.body as FormData;
    expect(formData.get("confirmPassword")).toBeNull();
  });

  it("TC-07: 정의되지 않은 임의 필드는 payload에 포함되지 않는다", () => {
    const inputWithExtra = { ...validInput, extra: "data" };

    const jsonResult = buildSignupRequestPayload(
      inputWithExtra as Parameters<typeof buildSignupRequestPayload>[0],
    );
    const body = jsonResult.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("extra");

    const file = new File(["content"], "avatar.png", { type: "image/png" });
    const multipartResult = buildSignupRequestPayload({
      ...inputWithExtra,
      avatarFile: file,
    } as Parameters<typeof buildSignupRequestPayload>[0]);
    const formData = multipartResult.body as FormData;
    expect(formData.get("extra")).toBeNull();
  });
});
