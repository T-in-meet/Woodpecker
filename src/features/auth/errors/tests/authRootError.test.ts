import { describe, expect, it } from "vitest";

import {
  AUTH_ROOT_ERROR_TYPE,
  shouldClearRootOnInputChange,
} from "../authRootError";

describe("shouldClearRootOnInputChange", () => {
  it("ATTEMPT root error이면 true를 반환한다", () => {
    expect(shouldClearRootOnInputChange(AUTH_ROOT_ERROR_TYPE.ATTEMPT)).toBe(
      true,
    );
  });

  it("SYSTEM root error이면 false를 반환한다", () => {
    expect(shouldClearRootOnInputChange(AUTH_ROOT_ERROR_TYPE.SYSTEM)).toBe(
      false,
    );
  });

  it("error type이 없으면 false를 반환한다", () => {
    expect(shouldClearRootOnInputChange()).toBe(false);
  });

  it("정의되지 않은 error type이면 false를 반환한다", () => {
    expect(shouldClearRootOnInputChange("server")).toBe(false);
  });

  it("문자열이 아닌 error type이면 false를 반환한다", () => {
    expect(shouldClearRootOnInputChange(1)).toBe(false);
  });
});
