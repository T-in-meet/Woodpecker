import { describe, expect, it } from "vitest";

import {
  formatDate,
  formatDateTime,
  formatRelativeDate,
  formatShortDateKST,
} from "../formatDate";

describe("formatDate", () => {
  it("Date 객체를 한국어 날짜 문자열로 변환한다", () => {
    const date = new Date("2024-01-15");
    const result = formatDate(date);
    expect(result).toContain("2024");
    expect(result).toContain("1");
    expect(result).toContain("15");
  });

  it("ISO 문자열을 받아도 동작한다", () => {
    const result = formatDate("2024-01-15");
    expect(result).toContain("2024");
  });
});

describe("formatDateTime", () => {
  it("formats UTC instants in KST regardless of server timezone", () => {
    const result = formatDateTime("2026-01-01T00:00:00.000Z", "en-US");

    expect(result).toContain("January 1, 2026");
    expect(result).toContain("09:00 AM");
  });
});

describe("formatShortDateKST", () => {
  it("월 이름 없이 짧은 숫자 형식으로 반환한다", () => {
    const result = formatShortDateKST("2026-08-24T00:00:00.000Z");

    expect(result).toContain("2026");
    expect(result).toContain("8");
    expect(result).toContain("24");
    expect(result).not.toContain("월");
  });

  it("끝에 붙는 온점을 제거한다", () => {
    expect(formatShortDateKST("2026-08-24T00:00:00.000Z")).toBe("2026. 8. 24");
  });

  it("서버 타임존과 무관하게 KST 기준으로 변환한다", () => {
    // UTC 2026-08-23 16:00 = KST 2026-08-24 01:00
    expect(formatShortDateKST("2026-08-23T16:00:00.000Z")).toContain("24");
  });
});

describe("formatRelativeDate", () => {
  it("오늘 날짜를 '오늘'로 반환한다", () => {
    expect(formatRelativeDate(new Date())).toBe("오늘");
  });
});
