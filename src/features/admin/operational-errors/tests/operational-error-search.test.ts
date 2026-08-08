import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperationalErrorListQuery } from "../types/operational-error-list";
import { applyOperationalErrorSearch } from "../utils/operational-error-search";

const ilikeMock = vi.fn();

const queryMock = {
  ilike: ilikeMock,
};

function createSearch(
  field: OperationalErrorListQuery["search"]["field"],
  query: string,
): OperationalErrorListQuery["search"] {
  return {
    field,
    query,
  };
}

describe("applyOperationalErrorSearch", () => {
  beforeEach(() => {
    ilikeMock.mockReset();
    ilikeMock.mockReturnValue(queryMock);
  });

  it("검색어가 비어 있으면 기존 쿼리를 그대로 반환한다", () => {
    const result = applyOperationalErrorSearch(
      queryMock as never,
      createSearch("message", "   "),
    );

    expect(result).toBe(queryMock);
    expect(ilikeMock).not.toHaveBeenCalled();
  });

  it("메시지 검색을 적용한다", () => {
    applyOperationalErrorSearch(
      queryMock as never,
      createSearch("message", "오류 발생"),
    );

    expect(ilikeMock).toHaveBeenCalledWith("message", "%오류 발생%");
  });

  it("오류 코드 검색을 적용한다", () => {
    applyOperationalErrorSearch(
      queryMock as never,
      createSearch("errorCode", "UNEXPECTED_ERROR"),
    );

    expect(ilikeMock).toHaveBeenCalledWith(
      "error_code",
      String.raw`%UNEXPECTED\_ERROR%`,
    );
  });

  it("작업 검색을 적용한다", () => {
    applyOperationalErrorSearch(
      queryMock as never,
      createSearch("operation", "createFeedback"),
    );

    expect(ilikeMock).toHaveBeenCalledWith("operation", "%createFeedback%");
  });

  it("단계 검색을 적용한다", () => {
    applyOperationalErrorSearch(
      queryMock as never,
      createSearch("stage", "SERVER_ACTION"),
    );

    expect(ilikeMock).toHaveBeenCalledWith(
      "stage",
      String.raw`%SERVER\_ACTION%`,
    );
  });

  it("검색어 앞뒤 공백을 제거한다", () => {
    applyOperationalErrorSearch(
      queryMock as never,
      createSearch("message", "  오류 발생  "),
    );

    expect(ilikeMock).toHaveBeenCalledWith("message", "%오류 발생%");
  });

  it("PostgREST 검색 특수문자를 이스케이프한다", () => {
    applyOperationalErrorSearch(
      queryMock as never,
      createSearch("message", String.raw`50%_error\code`),
    );

    expect(ilikeMock).toHaveBeenCalledWith(
      "message",
      String.raw`%50\%\_error\\code%`,
    );
  });
});
