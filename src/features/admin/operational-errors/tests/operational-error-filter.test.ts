import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAppliedFilter } from "../../types/filter";
import { nextDayIsoString, startOfDayIsoString } from "../../utils/query";
import type {
  OperationalErrorFilterField,
  OperationalErrorListQuery,
} from "../types/operational-error-list";
import { applyOperationalErrorFilters } from "../utils/operational-error-filter";

const gteMock = vi.fn();
const inMock = vi.fn();
const ltMock = vi.fn();
const lteMock = vi.fn();

const queryMock = {
  gte: gteMock,
  in: inMock,
  lt: ltMock,
  lte: lteMock,
};

/**
 * 단일 필터를 운영 오류 필터 객체 형태로 생성합니다.
 */
function createFilters<Field extends OperationalErrorFilterField>(
  filter: AdminAppliedFilter<Field>,
): OperationalErrorListQuery["filters"] {
  return {
    [filter.field]: filter,
  } as OperationalErrorListQuery["filters"];
}

describe("applyOperationalErrorFilters", () => {
  beforeEach(() => {
    gteMock.mockReset();
    inMock.mockReset();
    ltMock.mockReset();
    lteMock.mockReset();

    gteMock.mockReturnValue(queryMock);
    inMock.mockReturnValue(queryMock);
    ltMock.mockReturnValue(queryMock);
    lteMock.mockReturnValue(queryMock);
  });

  it("필터가 없으면 기존 쿼리를 그대로 반환한다", () => {
    const result = applyOperationalErrorFilters(queryMock as never, {});

    expect(result).toBe(queryMock);
    expect(gteMock).not.toHaveBeenCalled();
    expect(inMock).not.toHaveBeenCalled();
    expect(ltMock).not.toHaveBeenCalled();
    expect(lteMock).not.toHaveBeenCalled();
  });

  it("기능 필터를 적용한다", () => {
    const filters = createFilters({
      field: "feature",
      type: "multi-select",
      value: ["feedback", "notifications"],
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(inMock).toHaveBeenCalledWith("feature", [
      "feedback",
      "notifications",
    ]);
  });

  it("심각도 필터를 적용한다", () => {
    const filters = createFilters({
      field: "severity",
      type: "multi-select",
      value: ["ERROR", "WARNING"],
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(inMock).toHaveBeenCalledWith("severity", ["ERROR", "WARNING"]);
  });

  it("상태 필터를 적용한다", () => {
    const filters = createFilters({
      field: "status",
      type: "multi-select",
      value: ["OPEN", "RESOLVED"],
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(inMock).toHaveBeenCalledWith("status", ["OPEN", "RESOLVED"]);
  });

  it("최소 발생 횟수를 적용한다", () => {
    const filters = createFilters({
      field: "occurrenceCount",
      type: "number-range",
      value: {
        min: 3,
        max: null,
      },
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(gteMock).toHaveBeenCalledWith("occurrence_count", 3);
    expect(lteMock).not.toHaveBeenCalled();
  });

  it("최대 발생 횟수를 적용한다", () => {
    const filters = createFilters({
      field: "occurrenceCount",
      type: "number-range",
      value: {
        min: null,
        max: 10,
      },
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(lteMock).toHaveBeenCalledWith("occurrence_count", 10);
    expect(gteMock).not.toHaveBeenCalled();
  });

  it("발생 횟수의 최소값과 최대값을 함께 적용한다", () => {
    const filters = createFilters({
      field: "occurrenceCount",
      type: "number-range",
      value: {
        min: 3,
        max: 10,
      },
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(gteMock).toHaveBeenCalledWith("occurrence_count", 3);
    expect(lteMock).toHaveBeenCalledWith("occurrence_count", 10);
  });

  it("마지막 발생일의 시작일을 적용한다", () => {
    const from = new Date("2026-07-27T00:00:00.000Z");

    const filters = createFilters({
      field: "lastSeenAt",
      type: "date-range",
      value: {
        from,
        to: null,
      },
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(gteMock).toHaveBeenCalledWith(
      "last_seen_at",
      startOfDayIsoString(from),
    );
    expect(ltMock).not.toHaveBeenCalled();
  });

  it("마지막 발생일의 종료일을 다음 날 미만으로 적용한다", () => {
    const to = new Date("2026-07-28T00:00:00.000Z");

    const filters = createFilters({
      field: "lastSeenAt",
      type: "date-range",
      value: {
        from: null,
        to,
      },
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(ltMock).toHaveBeenCalledWith("last_seen_at", nextDayIsoString(to));
    expect(gteMock).not.toHaveBeenCalled();
  });

  it("마지막 발생일의 시작일과 종료일을 함께 적용한다", () => {
    const from = new Date("2026-07-27T00:00:00.000Z");
    const to = new Date("2026-07-28T00:00:00.000Z");

    const filters = createFilters({
      field: "lastSeenAt",
      type: "date-range",
      value: {
        from,
        to,
      },
    });

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(gteMock).toHaveBeenCalledWith(
      "last_seen_at",
      startOfDayIsoString(from),
    );
    expect(ltMock).toHaveBeenCalledWith("last_seen_at", nextDayIsoString(to));
  });

  it("여러 필터를 모두 적용한다", () => {
    const filters: OperationalErrorListQuery["filters"] = {
      feature: {
        field: "feature",
        type: "multi-select",
        value: ["feedback"],
      },
      occurrenceCount: {
        field: "occurrenceCount",
        type: "number-range",
        value: {
          min: 2,
          max: 5,
        },
      },
      status: {
        field: "status",
        type: "multi-select",
        value: ["OPEN"],
      },
    };

    applyOperationalErrorFilters(queryMock as never, filters);

    expect(inMock).toHaveBeenCalledWith("feature", ["feedback"]);
    expect(inMock).toHaveBeenCalledWith("status", ["OPEN"]);
    expect(gteMock).toHaveBeenCalledWith("occurrence_count", 2);
    expect(lteMock).toHaveBeenCalledWith("occurrence_count", 5);
  });
});
