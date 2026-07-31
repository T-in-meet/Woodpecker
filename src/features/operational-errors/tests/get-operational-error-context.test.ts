import { describe, expect, it } from "vitest";

import { getOperationalErrorContext } from "@/features/operational-errors/utils/get-operational-error-context";

describe("getOperationalErrorContext", () => {
  it("JavaScript Error의 이름과 메시지를 반환한다", () => {
    const error = new TypeError("잘못된 값입니다.");

    const result = getOperationalErrorContext(error);

    expect(result).toEqual({
      message: "잘못된 값입니다.",
      name: "TypeError",
    });
  });

  it("일반 오류 객체의 지원 속성을 반환한다", () => {
    const error = {
      code: "42703",
      details: "컬럼을 찾을 수 없습니다.",
      hint: "컬럼 이름을 확인하세요.",
      message: "column does not exist",
      name: "PostgrestError",
    };

    const result = getOperationalErrorContext(error);

    expect(result).toEqual({
      message: "column does not exist",
      name: "PostgrestError",
      code: "42703",
      details: "컬럼을 찾을 수 없습니다.",
      hint: "컬럼 이름을 확인하세요.",
    });
  });

  it("일반 오류 객체에서 문자열이 아닌 속성은 제외한다", () => {
    const error = {
      code: 42703,
      details: null,
      hint: undefined,
      message: "column does not exist",
      name: false,
    };

    const result = getOperationalErrorContext(error);

    expect(result).toEqual({
      message: "column does not exist",
    });
  });

  it("일반 오류 객체의 빈 문자열 속성은 제외한다", () => {
    const error = {
      code: "",
      details: "",
      hint: "",
      message: "",
      name: "",
    };

    const result = getOperationalErrorContext(error);

    expect(result).toEqual({
      message: "Unknown operational error",
    });
  });

  it("문자열 오류를 메시지로 반환한다", () => {
    const result = getOperationalErrorContext("직접 전달된 오류입니다.");

    expect(result).toEqual({
      message: "직접 전달된 오류입니다.",
    });
  });

  it("빈 문자열에는 기본 메시지를 반환한다", () => {
    const result = getOperationalErrorContext("");

    expect(result).toEqual({
      message: "Unknown operational error",
    });
  });

  it("null에는 기본 메시지를 반환한다", () => {
    const result = getOperationalErrorContext(null);

    expect(result).toEqual({
      message: "Unknown operational error",
    });
  });

  it("undefined에는 기본 메시지를 반환한다", () => {
    const result = getOperationalErrorContext(undefined);

    expect(result).toEqual({
      message: "Unknown operational error",
    });
  });

  it("숫자 오류에는 기본 메시지를 반환한다", () => {
    const result = getOperationalErrorContext(500);

    expect(result).toEqual({
      message: "Unknown operational error",
    });
  });

  it("사용자 정의 기본 메시지를 반환한다", () => {
    const result = getOperationalErrorContext(
      {
        code: "UNKNOWN",
      },
      "Unknown admin operational error",
    );

    expect(result).toEqual({
      message: "Unknown admin operational error",
      code: "UNKNOWN",
    });
  });

  it("일반 객체에 message가 없더라도 다른 지원 속성은 유지한다", () => {
    const error = {
      code: "PGRST116",
      details: "The result contains 0 rows",
      hint: "Use maybeSingle instead",
    };

    const result = getOperationalErrorContext(
      error,
      "운영 오류 정보를 확인할 수 없습니다.",
    );

    expect(result).toEqual({
      message: "운영 오류 정보를 확인할 수 없습니다.",
      code: "PGRST116",
      details: "The result contains 0 rows",
      hint: "Use maybeSingle instead",
    });
  });

  it("지원하지 않는 객체 속성은 결과에 포함하지 않는다", () => {
    const error = {
      body: "response body",
      endpoint: "https://example.com/push",
      headers: {
        authorization: "secret",
      },
      message: "푸시 전송에 실패했습니다.",
      statusCode: 410,
    };

    const result = getOperationalErrorContext(error);

    expect(result).toEqual({
      message: "푸시 전송에 실패했습니다.",
    });
  });
});
