/**
 * rateLimit.utils - pruneExpired 함수 테스트
 *
 * 목적:
 * - 슬라이딩 윈도우 로그 기반 타임스탬프 필터링 검증
 * - 만료된 타임스탬프만 제거, 유효한 것만 보존
 * - 불변성 보장 (입력 배열 변형 없음)
 */

import { describe, expect, it } from "vitest";

import { evaluateSlidingWindow, pruneExpired } from "./rateLimit.utils";

describe("pruneExpired", () => {
  /**
   * TC-SW-01: 빈 배열 → 빈 배열 반환
   */
  it("TC-SW-01: 빈 배열은 빈 배열로 반환된다", () => {
    const now = 1000;
    const windowMs = 500;

    const result = pruneExpired([], windowMs, now);

    expect(result).toEqual([]);
  });

  /**
   * TC-SW-02: windowMs 내 모든 타임스탬프 → 전부 보존
   */
  it("TC-SW-02: 윈도우 내 모든 타임스탬프는 보존된다", () => {
    const now = 1000;
    const windowMs = 500;
    // window_start = 1000 - 500 = 500
    const timestamps = [600, 700, 800, 900]; // 전부 >= 500

    const result = pruneExpired(timestamps, windowMs, now);

    expect(result).toEqual([600, 700, 800, 900]);
  });

  /**
   * TC-SW-03: windowMs 이전 타임스탬프 → 전부 제거
   */
  it("TC-SW-03: 윈도우 이전의 모든 타임스탬프는 제거된다", () => {
    const now = 1000;
    const windowMs = 500;
    // window_start = 1000 - 500 = 500
    const timestamps = [100, 200, 300, 400]; // 전부 < 500

    const result = pruneExpired(timestamps, windowMs, now);

    expect(result).toEqual([]);
  });

  /**
   * TC-SW-04: 혼합 배열 → 만료된 것만 제거, 유효한 것만 반환
   */
  it("TC-SW-04: 혼합 배열에서 만료된 타임스탬프만 제거된다", () => {
    const now = 1000;
    const windowMs = 500;
    // window_start = 1000 - 500 = 500
    const timestamps = [100, 300, 600, 700, 900]; // 100, 300 제거, 600, 700, 900 보존

    const result = pruneExpired(timestamps, windowMs, now);

    expect(result).toEqual([600, 700, 900]);
  });

  /**
   * TC-SW-05: windowStart 경계값 (t === now - windowMs) → 포함됨 (>=)
   */
  it("TC-SW-05: 경계값 타임스탬프는 윈도우에 포함된다 (>=)", () => {
    const now = 1000;
    const windowMs = 500;
    // window_start = 1000 - 500 = 500
    const timestamps = [499, 500, 501]; // 499 제거, 500과 501 보존

    const result = pruneExpired(timestamps, windowMs, now);

    expect(result).toEqual([500, 501]);
  });

  /**
   * TC-SW-06: 원본 배열 불변 — pruneExpired는 새 배열 반환, 입력 변형 없음
   */
  it("TC-SW-06: 입력 배열은 변형되지 않고 새 배열이 반환된다", () => {
    const now = 1000;
    const windowMs = 500;
    const original = [100, 600, 700];
    const originalCopy = [...original]; // 비교용 복사본

    const result = pruneExpired(original, windowMs, now);

    // 입력 배열은 변하지 않음
    expect(original).toEqual(originalCopy);
    // 반환된 배열은 새로운 객체
    expect(result).not.toBe(original);
    // 내용은 필터된 값
    expect(result).toEqual([600, 700]);
  });
});

describe("evaluateSlidingWindow", () => {
  it("TC-SW-EVAL-01: limit 미만이면 allowed=true, next에 now가 append된다", () => {
    const now = 1000;
    const result = evaluateSlidingWindow([600, 700], 3, 500, now);

    expect(result.allowed).toBe(true);
    expect(result.pruned).toEqual([600, 700]);
    expect(result.next).toEqual([600, 700, 1000]);
  });

  it("TC-SW-EVAL-02: limit 도달이면 allowed=false, next는 pruned와 동일하다", () => {
    const now = 1000;
    const result = evaluateSlidingWindow([600, 700], 2, 500, now);

    expect(result.allowed).toBe(false);
    expect(result.pruned).toEqual([600, 700]);
    expect(result.next).toEqual([600, 700]);
  });

  it("TC-SW-EVAL-03: appendOnAllow=false면 allowed=true여도 next append가 없다", () => {
    const now = 1000;
    const result = evaluateSlidingWindow([600], 2, 500, now, {
      appendOnAllow: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.pruned).toEqual([600]);
    expect(result.next).toEqual([600]);
  });

  it("TC-SW-EVAL-04: prune가 먼저 적용된 뒤 평가된다", () => {
    const now = 1000;
    const result = evaluateSlidingWindow([100, 600, 700], 2, 500, now);

    expect(result.pruned).toEqual([600, 700]);
    expect(result.allowed).toBe(false);
    expect(result.next).toEqual([600, 700]);
  });
});
