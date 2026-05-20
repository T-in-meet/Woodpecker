import { beforeEach, describe, expect, it } from "vitest";

import {
  consumeAuthEmailPrefillEmail,
  setAuthEmailPrefillEmail,
} from "./authEmailPrefillMemory";

describe("authEmailPrefillMemory", () => {
  beforeEach(() => {
    /**
     * module-level memory 초기화
     */
    setAuthEmailPrefillEmail(null);
  });

  it("prefill 이메일을 저장한 뒤 소비할 수 있다", () => {
    setAuthEmailPrefillEmail("user@example.com");

    expect(consumeAuthEmailPrefillEmail()).toBe("user@example.com");
  });

  it("prefill 이메일은 한 번 소비하면 제거된다", () => {
    setAuthEmailPrefillEmail("user@example.com");

    expect(consumeAuthEmailPrefillEmail()).toBe("user@example.com");
    expect(consumeAuthEmailPrefillEmail()).toBeNull();
  });

  it("prefill 이메일을 null로 저장하면 기존 값을 제거한다", () => {
    setAuthEmailPrefillEmail("user@example.com");
    setAuthEmailPrefillEmail(null);

    expect(consumeAuthEmailPrefillEmail()).toBeNull();
  });

  it("새로운 prefill 이메일을 저장하면 이전 값을 덮어쓴다", () => {
    setAuthEmailPrefillEmail("old@example.com");
    setAuthEmailPrefillEmail("new@example.com");

    expect(consumeAuthEmailPrefillEmail()).toBe("new@example.com");
  });
});
