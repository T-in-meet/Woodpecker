import { describe, expect, it } from "vitest";

import { formatDate, formatRelativeDate } from "../formatDate";

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

describe("formatRelativeDate", () => {
  it("오늘 날짜를 '오늘'로 반환한다", () => {
    expect(formatRelativeDate(new Date())).toBe("오늘");
  });
});
