import { describe, expect, it } from "vitest";

import {
  nextDayIsoString,
  startOfDayIsoString,
} from "@/features/admin/utils/query";

import {
  getDateRangeRpcFrom,
  getDateRangeRpcTo,
  getMultiSelectRpcValues,
  getNumberRangeRpcMax,
  getNumberRangeRpcMin,
  getSelectBooleanRpcValue,
} from "../utils/list-rpc";

describe("getMultiSelectRpcValues", () => {
  it("multi-select 값을 RPC 배열로 반환한다", () => {
    expect(
      getMultiSelectRpcValues({
        field: "provider",
        type: "multi-select",
        value: ["openai", "google"],
      }),
    ).toEqual(["openai", "google"]);
  });

  it("필터가 없으면 null을 반환한다", () => {
    expect(getMultiSelectRpcValues(undefined)).toBeNull();
  });

  it("multi-select 값이 비어 있으면 null을 반환한다", () => {
    expect(
      getMultiSelectRpcValues({
        field: "provider",
        type: "multi-select",
        value: [],
      }),
    ).toBeNull();
  });

  it("다른 타입의 필터이면 null을 반환한다", () => {
    expect(
      getMultiSelectRpcValues({
        field: "isActive",
        type: "select",
        value: "true",
      }),
    ).toBeNull();
  });
});

describe("getSelectBooleanRpcValue", () => {
  it("true 값을 boolean true로 변환한다", () => {
    expect(
      getSelectBooleanRpcValue({
        field: "isActive",
        type: "select",
        value: "true",
      }),
    ).toBe(true);
  });

  it("false 값을 boolean false로 변환한다", () => {
    expect(
      getSelectBooleanRpcValue({
        field: "isActive",
        type: "select",
        value: "false",
      }),
    ).toBe(false);
  });

  it("boolean으로 변환할 수 없는 선택 값은 null을 반환한다", () => {
    expect(
      getSelectBooleanRpcValue({
        field: "isActive",
        type: "select",
        value: "all",
      }),
    ).toBeNull();
  });

  it("필터가 없거나 select가 아니면 null을 반환한다", () => {
    expect(getSelectBooleanRpcValue(undefined)).toBeNull();

    expect(
      getSelectBooleanRpcValue({
        field: "provider",
        type: "multi-select",
        value: ["openai"],
      }),
    ).toBeNull();
  });
});

describe("number range RPC helpers", () => {
  it("number-range의 최소값과 최대값을 반환한다", () => {
    const filter = {
      field: "referenceCount",
      type: "number-range" as const,
      value: {
        min: 2,
        max: 10,
      },
    };

    expect(getNumberRangeRpcMin(filter)).toBe(2);
    expect(getNumberRangeRpcMax(filter)).toBe(10);
  });

  it("number-range 필터가 아니면 null을 반환한다", () => {
    expect(getNumberRangeRpcMin(undefined)).toBeNull();
    expect(getNumberRangeRpcMax(undefined)).toBeNull();

    const filter = {
      field: "provider",
      type: "multi-select" as const,
      value: ["openai"],
    };

    expect(getNumberRangeRpcMin(filter)).toBeNull();
    expect(getNumberRangeRpcMax(filter)).toBeNull();
  });
});

describe("date range RPC helpers", () => {
  it("시작 날짜를 해당 날짜 00:00 ISO 문자열로 변환한다", () => {
    const from = new Date("2026-08-10T12:34:56.000Z");

    const result = getDateRangeRpcFrom({
      field: "createdAt",
      type: "date-range",
      value: {
        from,
        to: null,
      },
    });

    expect(result).toBe(startOfDayIsoString(from));
  });

  it("종료 날짜를 다음 날 00:00 ISO 문자열로 변환한다", () => {
    const to = new Date("2026-08-10T12:34:56.000Z");

    const result = getDateRangeRpcTo({
      field: "createdAt",
      type: "date-range",
      value: {
        from: null,
        to,
      },
    });

    expect(result).toBe(nextDayIsoString(to));
  });

  it("시작 날짜가 없으면 from은 null을 반환한다", () => {
    expect(
      getDateRangeRpcFrom({
        field: "createdAt",
        type: "date-range",
        value: {
          from: null,
          to: new Date("2026-08-10T00:00:00.000Z"),
        },
      }),
    ).toBeNull();
  });

  it("종료 날짜가 없으면 to는 null을 반환한다", () => {
    expect(
      getDateRangeRpcTo({
        field: "createdAt",
        type: "date-range",
        value: {
          from: new Date("2026-08-10T00:00:00.000Z"),
          to: null,
        },
      }),
    ).toBeNull();
  });

  it("date-range 필터가 아니면 null을 반환한다", () => {
    expect(getDateRangeRpcFrom(undefined)).toBeNull();
    expect(getDateRangeRpcTo(undefined)).toBeNull();

    const filter = {
      field: "provider",
      type: "multi-select" as const,
      value: ["openai"],
    };

    expect(getDateRangeRpcFrom(filter)).toBeNull();
    expect(getDateRangeRpcTo(filter)).toBeNull();
  });
});
