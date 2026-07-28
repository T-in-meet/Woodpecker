import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  escapePostgrestLikePattern,
  nextDayIsoString,
  startOfDayIsoString,
} from "../utils/operational-error-query";

describe("operational-error-query", () => {
  const originalTimezone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = "Asia/Seoul";
  });

  afterAll(() => {
    if (originalTimezone === undefined) {
      delete process.env.TZ;
      return;
    }

    process.env.TZ = originalTimezone;
  });

  describe("startOfDayIsoString", () => {
    it("전달된 날짜의 로컬 자정을 ISO 문자열로 반환한다", () => {
      const date = new Date("2026-07-28T15:30:45.123+09:00");

      expect(startOfDayIsoString(date)).toBe("2026-07-27T15:00:00.000Z");
    });

    it("원본 Date 객체를 변경하지 않는다", () => {
      const date = new Date("2026-07-28T15:30:45.123+09:00");
      const originalTime = date.getTime();

      startOfDayIsoString(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe("nextDayIsoString", () => {
    it("전달된 날짜의 다음 날 로컬 자정을 ISO 문자열로 반환한다", () => {
      const date = new Date("2026-07-28T15:30:45.123+09:00");

      expect(nextDayIsoString(date)).toBe("2026-07-28T15:00:00.000Z");
    });

    it("월이 변경되는 날짜도 올바르게 계산한다", () => {
      const date = new Date("2026-07-31T12:00:00.000+09:00");

      expect(nextDayIsoString(date)).toBe("2026-07-31T15:00:00.000Z");
    });

    it("원본 Date 객체를 변경하지 않는다", () => {
      const date = new Date("2026-07-28T15:30:45.123+09:00");
      const originalTime = date.getTime();

      nextDayIsoString(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe("escapePostgrestLikePattern", () => {
    it("역슬래시를 이스케이프한다", () => {
      expect(escapePostgrestLikePattern(String.raw`error\message`)).toBe(
        String.raw`error\\message`,
      );
    });

    it("퍼센트 기호를 이스케이프한다", () => {
      expect(escapePostgrestLikePattern("100%")).toBe(String.raw`100\%`);
    });

    it("밑줄을 이스케이프한다", () => {
      expect(escapePostgrestLikePattern("error_message")).toBe(
        String.raw`error\_message`,
      );
    });

    it("여러 특수문자를 순서대로 모두 이스케이프한다", () => {
      expect(escapePostgrestLikePattern(String.raw`50%\_error`)).toBe(
        String.raw`50\%\\\_error`,
      );
    });

    it("특수문자가 없는 문자열은 그대로 반환한다", () => {
      expect(escapePostgrestLikePattern("operational error")).toBe(
        "operational error",
      );
    });

    it("빈 문자열을 그대로 반환한다", () => {
      expect(escapePostgrestLikePattern("")).toBe("");
    });
  });
});
