import { describe, expect, it } from "vitest";

import {
  createFeedbackContentPreview,
  escapePostgrestLikePattern,
  nextDayIsoString,
  startOfDayIsoString,
} from "../utils/feedback-query";

describe("createFeedbackContentPreview", () => {
  it("연속된 공백과 줄바꿈을 하나의 공백으로 정규화한다", () => {
    const result = createFeedbackContentPreview(
      "  첫 번째 줄\n\n두 번째\t문장   마지막  ",
    );

    expect(result).toBe("첫 번째 줄 두 번째 문장 마지막");
  });

  it("정규화된 문자열이 80자 이하면 그대로 반환한다", () => {
    const content = "a".repeat(80);

    expect(createFeedbackContentPreview(content)).toBe(content);
  });

  it("정규화된 문자열이 80자를 초과하면 잘라서 말줄임표를 추가한다", () => {
    const content = "a".repeat(81);

    expect(createFeedbackContentPreview(content)).toBe(`${"a".repeat(80)}...`);
  });
});

describe("escapePostgrestLikePattern", () => {
  it("%와 _를 PostgREST 와일드카드로 해석되지 않도록 이스케이프한다", () => {
    expect(escapePostgrestLikePattern("100%_complete")).toBe(
      "100\\%\\_complete",
    );
  });

  it("기존 역슬래시를 먼저 이스케이프한다", () => {
    expect(escapePostgrestLikePattern(String.raw`folder\100%_test`)).toBe(
      String.raw`folder\\100\%\_test`,
    );
  });

  it("이스케이프할 문자가 없으면 원본 문자열을 반환한다", () => {
    expect(escapePostgrestLikePattern("feedback title")).toBe("feedback title");
  });
});

describe("startOfDayIsoString", () => {
  it("Date 값을 해당 지역 날짜의 00시 ISO 문자열로 변환한다", () => {
    const value = new Date(2026, 6, 25, 15, 30, 45, 123);
    const expected = new Date(2026, 6, 25, 0, 0, 0, 0).toISOString();

    expect(startOfDayIsoString(value)).toBe(expected);
  });

  it("문자열 날짜도 해당 일자의 00시로 변환한다", () => {
    const value = "2026-07-25T15:30:45";
    const expected = new Date(2026, 6, 25, 0, 0, 0, 0).toISOString();

    expect(startOfDayIsoString(value)).toBe(expected);
  });
});

describe("nextDayIsoString", () => {
  it("종료 날짜의 다음 날 00시 ISO 문자열을 반환한다", () => {
    const value = new Date(2026, 6, 25, 15, 30, 45, 123);
    const expected = new Date(2026, 6, 26, 0, 0, 0, 0).toISOString();

    expect(nextDayIsoString(value)).toBe(expected);
  });

  it("월의 마지막 날짜에서 다음 달 첫날로 넘어간다", () => {
    const value = new Date(2026, 6, 31, 12, 0, 0);
    const expected = new Date(2026, 7, 1, 0, 0, 0, 0).toISOString();

    expect(nextDayIsoString(value)).toBe(expected);
  });
});
