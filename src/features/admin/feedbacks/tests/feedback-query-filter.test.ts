import { beforeEach, describe, expect, it, vi } from "vitest";

const { startOfDayIsoStringMock, nextDayIsoStringMock } = vi.hoisted(() => ({
  startOfDayIsoStringMock: vi.fn(),
  nextDayIsoStringMock: vi.fn(),
}));

vi.mock("@/features/admin/utils/query", () => ({
  startOfDayIsoString: startOfDayIsoStringMock,
  nextDayIsoString: nextDayIsoStringMock,
}));

import { applyFeedbackFilters } from "../utils/feedback-query-filter";

function createFeedbackQueryMock() {
  const query = {
    in: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    not: vi.fn(),
    eq: vi.fn(),
    filter: vi.fn(),
    is: vi.fn(),
  };

  query.in.mockReturnValue(query);
  query.gte.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.filter.mockReturnValue(query);
  query.is.mockReturnValue(query);

  return query;
}

describe("applyFeedbackFilters", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    startOfDayIsoStringMock.mockReturnValue("2026-07-01T00:00:00.000Z");
    nextDayIsoStringMock.mockReturnValue("2026-08-01T00:00:00.000Z");
  });

  it("카테고리와 상태 다중 선택 필터를 적용한다", () => {
    const query = createFeedbackQueryMock();

    const result = applyFeedbackFilters(query as never, {
      category: {
        field: "category",
        type: "multi-select",
        value: ["BUG", "FEATURE"],
      },
      status: {
        field: "status",
        type: "multi-select",
        value: ["OPEN"],
      },
    });

    expect(query.in).toHaveBeenNthCalledWith(1, "category", ["BUG", "FEATURE"]);
    expect(query.in).toHaveBeenNthCalledWith(2, "status", ["OPEN"]);
    expect(result).toBe(query);
  });

  it("영역 다중 선택 필터를 적용한다", () => {
    const query = createFeedbackQueryMock();

    const result = applyFeedbackFilters(query as never, {
      area: {
        field: "area",
        type: "multi-select",
        value: ["AI", "NOTIFICATION"],
      },
    });

    expect(query.in).toHaveBeenCalledWith("area", ["AI", "NOTIFICATION"]);
    expect(result).toBe(query);
  });

  it("등록일 시작일과 종료일을 포함하는 범위 조건을 적용한다", () => {
    const query = createFeedbackQueryMock();
    const from = new Date(2026, 6, 1);
    const to = new Date(2026, 6, 31);

    applyFeedbackFilters(query as never, {
      createdAt: {
        field: "createdAt",
        type: "date-range",
        value: {
          from,
          to,
        },
      },
    });

    expect(startOfDayIsoStringMock).toHaveBeenCalledWith(from);
    expect(nextDayIsoStringMock).toHaveBeenCalledWith(to);

    expect(query.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-07-01T00:00:00.000Z",
    );
    expect(query.lt).toHaveBeenCalledWith(
      "created_at",
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("등록일 범위에서 설정된 날짜 조건만 적용한다", () => {
    const query = createFeedbackQueryMock();
    const from = new Date(2026, 6, 1);

    applyFeedbackFilters(query as never, {
      createdAt: {
        field: "createdAt",
        type: "date-range",
        value: {
          from,
          to: null,
        },
      },
    });

    expect(query.gte).toHaveBeenCalledOnce();
    expect(query.lt).not.toHaveBeenCalled();
    expect(nextDayIsoStringMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      value: "yes",
      expectedMethod: "not",
      expectedArguments: ["image_urls", "eq", "{}"],
    },
    {
      value: "no",
      expectedMethod: "filter",
      expectedArguments: ["image_urls", "eq", "{}"],
    },
  ] as const)(
    "이미지 포함 여부가 $value이면 알맞은 조건을 적용한다",
    ({ value, expectedMethod, expectedArguments }) => {
      const query = createFeedbackQueryMock();

      applyFeedbackFilters(query as never, {
        hasImages: {
          field: "hasImages",
          type: "select",
          value,
        },
      });

      expect(query[expectedMethod]).toHaveBeenCalledWith(...expectedArguments);
    },
  );

  it.each([
    {
      value: "yes",
      expectedMethod: "not",
      expectedArguments: ["note_id", "is", null],
    },
    {
      value: "no",
      expectedMethod: "is",
      expectedArguments: ["note_id", null],
    },
  ] as const)(
    "노트 연결 여부가 $value이면 알맞은 조건을 적용한다",
    ({ value, expectedMethod, expectedArguments }) => {
      const query = createFeedbackQueryMock();

      applyFeedbackFilters(query as never, {
        noteLinked: {
          field: "noteLinked",
          type: "select",
          value,
        },
      });

      expect(query[expectedMethod]).toHaveBeenCalledWith(...expectedArguments);
    },
  );

  it("적용된 필터가 없으면 조회 조건을 변경하지 않는다", () => {
    const query = createFeedbackQueryMock();

    const result = applyFeedbackFilters(query as never, {});

    expect(query.in).not.toHaveBeenCalled();
    expect(query.gte).not.toHaveBeenCalled();
    expect(query.lt).not.toHaveBeenCalled();
    expect(query.not).not.toHaveBeenCalled();
    expect(query.eq).not.toHaveBeenCalled();
    expect(query.filter).not.toHaveBeenCalled();
    expect(query.is).not.toHaveBeenCalled();
    expect(result).toBe(query);
  });
});
