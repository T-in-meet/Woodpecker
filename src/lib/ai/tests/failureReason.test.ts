import { describe, expect, it, vi } from "vitest";

// client.ts는 server-only를 import하는데 jsdom에서는 그것만으로 throw한다.
vi.mock("server-only", () => ({}));

import { CloudflareAiError } from "../client";
import { toAiFailureReason } from "../failureReason";

describe("toAiFailureReason", () => {
  it("로컬 timeout은 delayed로 본다", () => {
    // AbortSignal.timeout()으로 끊긴 경우다. 응답을 못 받았으므로 코드가 없다.
    expect(toAiFailureReason(new CloudflareAiError("timeout"))).toBe("delayed");
  });

  it("로컬 abort는 delayed로 본다", () => {
    expect(toAiFailureReason(new CloudflareAiError("aborted"))).toBe("delayed");
  });

  it.each([
    [3006, "tooLarge"],
    [3007, "delayed"],
    [3008, "delayed"],
    [3036, "quotaExhausted"],
    [3040, "busy"],
    [4006, "quotaExhausted"],
  ] as const)("Cloudflare 코드 %i는 %s로 옮긴다", (code, expected) => {
    expect(toAiFailureReason(new CloudflareAiError("provider", code))).toBe(
      expected,
    );
  });

  it("실측된 한도 소진 코드(4006)도 문서 코드(3036)와 같게 다룬다", () => {
    // 문서에는 3036만 있으나 실제 응답은 4006이었다(2026-08-13).
    // 어느 쪽이 오든 사용자에게는 "오늘 사용량 소진"으로 안내해야 한다.
    expect(
      toAiFailureReason(new CloudflareAiError("provider", 4006, 429)),
    ).toBe(toAiFailureReason(new CloudflareAiError("provider", 3036, 429)));
  });

  it("일일 한도 소진(3036)과 요청 과대(3006)를 구분한다", () => {
    // 전자는 기다리면 풀리고 후자는 재시도해도 그대로다. 안내가 달라야 한다.
    const exhausted = toAiFailureReason(
      new CloudflareAiError("provider", 3036, 429),
    );
    const tooLarge = toAiFailureReason(
      new CloudflareAiError("provider", 3006, 413),
    );

    expect(exhausted).toBe("quotaExhausted");
    expect(tooLarge).toBe("tooLarge");
    expect(exhausted).not.toBe(tooLarge);
  });

  it("모르는 코드는 unknown으로 떨어뜨린다", () => {
    expect(toAiFailureReason(new CloudflareAiError("provider", 3042))).toBe(
      "unknown",
    );
  });

  it("코드 없는 provider 실패는 unknown이다", () => {
    expect(toAiFailureReason(new CloudflareAiError("provider"))).toBe(
      "unknown",
    );
  });

  it("설정 누락은 사용량 문제로 오인하지 않는다", () => {
    // 키가 없는 건 운영 실수다. 사용자에게 "한도 소진"이라고 말하면 안 된다.
    expect(toAiFailureReason(new CloudflareAiError("config"))).toBe("unknown");
  });

  it("네트워크 실패는 unknown이다", () => {
    expect(toAiFailureReason(new CloudflareAiError("network"))).toBe("unknown");
  });

  it("CloudflareAiError가 아닌 값은 unknown이다", () => {
    expect(toAiFailureReason(new Error("무언가 잘못됨"))).toBe("unknown");
    expect(toAiFailureReason(null)).toBe("unknown");
    expect(toAiFailureReason("문자열")).toBe("unknown");
  });
});
