import { describe, expect, it } from "vitest";

import {
  compareNullableString,
  includesSearch,
  paginateItems,
} from "../utils/list-utils";

describe("includesSearch", () => {
  it("검색어를 trim하고 대소문자를 구분하지 않고 포함 여부를 확인한다", () => {
    expect(includesSearch("GPT-4o Mini", "  gpt-4O  ")).toBe(true);
  });

  it("검색 대상에 검색어가 없으면 false를 반환한다", () => {
    expect(includesSearch("Gemini Flash", "gpt")).toBe(false);
  });

  it("검색어가 비어 있으면 항상 true를 반환한다", () => {
    expect(includesSearch("GPT-4o Mini", "   ")).toBe(true);
    expect(includesSearch(null, "")).toBe(true);
  });

  it("검색 대상 값이 null이고 검색어가 있으면 false를 반환한다", () => {
    expect(includesSearch(null, "gpt")).toBe(false);
  });
});

describe("paginateItems", () => {
  it("요청한 페이지의 항목과 페이지네이션 정보를 반환한다", () => {
    const result = paginateItems([1, 2, 3, 4, 5], 2, 2);

    expect(result).toEqual({
      items: [3, 4],
      pagination: {
        page: 2,
        pageSize: 2,
        total: 5,
        totalPages: 3,
      },
    });
  });

  it("page가 1보다 작으면 첫 페이지로 보정한다", () => {
    const result = paginateItems([1, 2, 3], 0, 2);

    expect(result).toEqual({
      items: [1, 2],
      pagination: {
        page: 1,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      },
    });
  });

  it("전체 범위를 벗어난 페이지면 빈 항목과 전체 메타데이터를 반환한다", () => {
    const result = paginateItems([1, 2, 3], 99, 2);

    expect(result).toEqual({
      items: [],
      pagination: {
        page: 99,
        pageSize: 2,
        total: 3,
        totalPages: 2,
      },
    });
  });

  it("전체 항목이 없으면 totalPages는 0이다", () => {
    expect(paginateItems([], 1, 10)).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 0,
      },
    });
  });
});

describe("compareNullableString", () => {
  it("문자열을 localeCompare 기준으로 비교한다", () => {
    expect(compareNullableString("alpha", "beta")).toBeLessThan(0);
    expect(compareNullableString("beta", "alpha")).toBeGreaterThan(0);
    expect(compareNullableString("alpha", "alpha")).toBe(0);
  });

  it("null을 빈 문자열로 취급한다", () => {
    expect(compareNullableString(null, null)).toBe(0);
    expect(compareNullableString(null, "alpha")).toBeLessThan(0);
    expect(compareNullableString("alpha", null)).toBeGreaterThan(0);
  });
});
