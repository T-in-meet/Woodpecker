import { describe, expect, it } from "vitest";

import type {
  AdminAppliedFilter,
  AdminFilterDefinition,
} from "@/features/admin/types/filter";

import {
  createEmptyAdminAppliedFilter,
  getAdminFilterStatusMessage,
  getAdminFilterValidationError,
  hasAdminFilterValue,
} from "./admin-filter";

type TestFilterField = "status" | "roles" | "score" | "createdAt";

const SELECT_FILTER: AdminFilterDefinition<TestFilterField> = {
  field: "status",
  label: "상태",
  type: "select",
  options: [
    {
      value: "active",
      label: "활성",
    },
    {
      value: "inactive",
      label: "비활성",
    },
  ],
};

const MULTI_SELECT_FILTER: AdminFilterDefinition<TestFilterField> = {
  field: "roles",
  label: "역할",
  type: "multi-select",
  options: [
    {
      value: "user",
      label: "사용자",
    },
    {
      value: "admin",
      label: "관리자",
    },
  ],
};

const NUMBER_RANGE_FILTER: AdminFilterDefinition<TestFilterField> = {
  field: "score",
  label: "점수",
  type: "number-range",
  min: 0,
  max: 100,
  step: 1,
};

const DATE_RANGE_FILTER: AdminFilterDefinition<TestFilterField> = {
  field: "createdAt",
  label: "가입일",
  type: "date-range",
};

describe("hasAdminFilterValue", () => {
  it("단일 선택 필터의 값이 빈 문자열이면 false를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "status",
      type: "select",
      value: "",
    };

    expect(hasAdminFilterValue(filter)).toBe(false);
  });

  it("단일 선택 필터의 값이 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "status",
      type: "select",
      value: "active",
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("다중 선택 필터의 값이 빈 배열이면 false를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "roles",
      type: "multi-select",
      value: [],
    };

    expect(hasAdminFilterValue(filter)).toBe(false);
  });

  it("다중 선택 필터에 선택된 값이 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "roles",
      type: "multi-select",
      value: ["user", "admin"],
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("숫자 범위의 최솟값과 최댓값이 모두 null이면 false를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: null,
        max: null,
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(false);
  });

  it("숫자 범위에 최솟값만 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: 0,
        max: null,
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("숫자 범위에 최댓값만 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: null,
        max: 100,
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("숫자 범위에 최솟값과 최댓값이 모두 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: 0,
        max: 100,
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("날짜 범위의 시작일과 종료일이 모두 null이면 false를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: null,
        to: null,
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(false);
  });

  it("날짜 범위에 시작일만 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: null,
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("날짜 범위에 종료일만 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: null,
        to: new Date("2026-12-31T00:00:00.000Z"),
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });

  it("날짜 범위에 시작일과 종료일이 모두 있으면 true를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-12-31T00:00:00.000Z"),
      },
    };

    expect(hasAdminFilterValue(filter)).toBe(true);
  });
});

describe("getAdminFilterValidationError", () => {
  it("필터가 null이면 오류 없이 null을 반환한다", () => {
    expect(getAdminFilterValidationError(null)).toBeNull();
  });

  it("단일 선택 필터는 별도의 유효성 오류를 반환하지 않는다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "status",
      type: "select",
      value: "active",
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("다중 선택 필터는 별도의 유효성 오류를 반환하지 않는다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "roles",
      type: "multi-select",
      value: ["admin"],
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("숫자 범위의 최솟값이 최댓값보다 크면 오류 메시지를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: 80,
        max: 50,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBe(
      "최솟값은 최댓값보다 클 수 없습니다.",
    );
  });

  it("숫자 범위의 최솟값과 최댓값이 같으면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: 50,
        max: 50,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("숫자 범위의 최솟값이 최댓값보다 작으면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: 20,
        max: 80,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("숫자 범위에 최솟값만 있으면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: 20,
        max: null,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("숫자 범위에 최댓값만 있으면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "score",
      type: "number-range",
      value: {
        min: null,
        max: 80,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("날짜 범위의 시작일이 종료일보다 늦으면 오류 메시지를 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: new Date("2026-12-31T00:00:00.000Z"),
        to: new Date("2026-01-01T00:00:00.000Z"),
      },
    };

    expect(getAdminFilterValidationError(filter)).toBe(
      "시작일은 종료일보다 늦을 수 없습니다.",
    );
  });

  it("날짜 범위의 시작일과 종료일이 같으면 null을 반환한다", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");

    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: date,
        to: date,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("날짜 범위의 시작일이 종료일보다 이르면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-12-31T00:00:00.000Z"),
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("날짜 범위에 시작일만 있으면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: null,
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });

  it("날짜 범위에 종료일만 있으면 null을 반환한다", () => {
    const filter: AdminAppliedFilter<TestFilterField> = {
      field: "createdAt",
      type: "date-range",
      value: {
        from: null,
        to: new Date("2026-12-31T00:00:00.000Z"),
      },
    };

    expect(getAdminFilterValidationError(filter)).toBeNull();
  });
});

describe("createEmptyAdminAppliedFilter", () => {
  it("단일 선택 필터 정의에서 빈 문자열 값을 생성한다", () => {
    expect(createEmptyAdminAppliedFilter(SELECT_FILTER)).toEqual({
      field: "status",
      type: "select",
      value: "",
    });
  });

  it("다중 선택 필터 정의에서 빈 배열 값을 생성한다", () => {
    expect(createEmptyAdminAppliedFilter(MULTI_SELECT_FILTER)).toEqual({
      field: "roles",
      type: "multi-select",
      value: [],
    });
  });

  it("숫자 범위 필터 정의에서 비어 있는 범위 값을 생성한다", () => {
    expect(createEmptyAdminAppliedFilter(NUMBER_RANGE_FILTER)).toEqual({
      field: "score",
      type: "number-range",
      value: {
        min: null,
        max: null,
      },
    });
  });

  it("날짜 범위 필터 정의에서 비어 있는 범위 값을 생성한다", () => {
    expect(createEmptyAdminAppliedFilter(DATE_RANGE_FILTER)).toEqual({
      field: "createdAt",
      type: "date-range",
      value: {
        from: null,
        to: null,
      },
    });
  });
});

describe("getAdminFilterStatusMessage", () => {
  describe("select", () => {
    it("선택된 값이 없으면 미선택 문구를 반환한다", () => {
      expect(getAdminFilterStatusMessage(SELECT_FILTER, null)).toBe(
        "선택된 항목이 없습니다.",
      );
    });

    it("선택된 값이 빈 문자열이면 미선택 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "status",
        type: "select",
        value: "",
      };

      expect(getAdminFilterStatusMessage(SELECT_FILTER, value)).toBe(
        "선택된 항목이 없습니다.",
      );
    });

    it("선택된 값이 있으면 선택 완료 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "status",
        type: "select",
        value: "active",
      };

      expect(getAdminFilterStatusMessage(SELECT_FILTER, value)).toBe(
        "1개 항목이 선택되었습니다.",
      );
    });

    it("필터 정의와 값의 타입이 다르면 미선택 상태로 처리한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "roles",
        type: "multi-select",
        value: ["admin"],
      };

      expect(getAdminFilterStatusMessage(SELECT_FILTER, value)).toBe(
        "선택된 항목이 없습니다.",
      );
    });
  });

  describe("multi-select", () => {
    it("선택된 값이 없으면 미선택 문구를 반환한다", () => {
      expect(getAdminFilterStatusMessage(MULTI_SELECT_FILTER, null)).toBe(
        "선택된 항목이 없습니다.",
      );
    });

    it("선택된 값이 빈 배열이면 미선택 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "roles",
        type: "multi-select",
        value: [],
      };

      expect(getAdminFilterStatusMessage(MULTI_SELECT_FILTER, value)).toBe(
        "선택된 항목이 없습니다.",
      );
    });

    it("선택된 값의 개수를 포함한 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "roles",
        type: "multi-select",
        value: ["user", "admin"],
      };

      expect(getAdminFilterStatusMessage(MULTI_SELECT_FILTER, value)).toBe(
        "2개 항목이 선택되었습니다.",
      );
    });

    it("필터 정의와 값의 타입이 다르면 미선택 상태로 처리한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "status",
        type: "select",
        value: "active",
      };

      expect(getAdminFilterStatusMessage(MULTI_SELECT_FILTER, value)).toBe(
        "선택된 항목이 없습니다.",
      );
    });
  });

  describe("number-range", () => {
    it("최솟값과 최댓값이 모두 없으면 미입력 문구를 반환한다", () => {
      expect(getAdminFilterStatusMessage(NUMBER_RANGE_FILTER, null)).toBe(
        "입력된 숫자 범위가 없습니다.",
      );
    });

    it("최솟값만 있으면 최솟값 입력 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "score",
        type: "number-range",
        value: {
          min: 0,
          max: null,
        },
      };

      expect(getAdminFilterStatusMessage(NUMBER_RANGE_FILTER, value)).toBe(
        "최솟값이 입력되었습니다.",
      );
    });

    it("최댓값만 있으면 최댓값 입력 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "score",
        type: "number-range",
        value: {
          min: null,
          max: 100,
        },
      };

      expect(getAdminFilterStatusMessage(NUMBER_RANGE_FILTER, value)).toBe(
        "최댓값이 입력되었습니다.",
      );
    });

    it("최솟값과 최댓값이 모두 있으면 전체 범위 입력 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "score",
        type: "number-range",
        value: {
          min: 0,
          max: 100,
        },
      };

      expect(getAdminFilterStatusMessage(NUMBER_RANGE_FILTER, value)).toBe(
        "최솟값과 최댓값이 입력되었습니다.",
      );
    });

    it("필터 정의와 값의 타입이 다르면 미입력 상태로 처리한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "status",
        type: "select",
        value: "active",
      };

      expect(getAdminFilterStatusMessage(NUMBER_RANGE_FILTER, value)).toBe(
        "입력된 숫자 범위가 없습니다.",
      );
    });
  });

  describe("date-range", () => {
    it("시작일과 종료일이 모두 없으면 미선택 문구를 반환한다", () => {
      expect(getAdminFilterStatusMessage(DATE_RANGE_FILTER, null)).toBe(
        "선택된 날짜가 없습니다.",
      );
    });

    it("시작일만 있으면 시작일 선택 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "createdAt",
        type: "date-range",
        value: {
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: null,
        },
      };

      expect(getAdminFilterStatusMessage(DATE_RANGE_FILTER, value)).toBe(
        "시작일이 선택되었습니다.",
      );
    });

    it("종료일만 있으면 종료일 선택 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "createdAt",
        type: "date-range",
        value: {
          from: null,
          to: new Date("2026-12-31T00:00:00.000Z"),
        },
      };

      expect(getAdminFilterStatusMessage(DATE_RANGE_FILTER, value)).toBe(
        "종료일이 선택되었습니다.",
      );
    });

    it("시작일과 종료일이 모두 있으면 전체 범위 선택 문구를 반환한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "createdAt",
        type: "date-range",
        value: {
          from: new Date("2026-01-01T00:00:00.000Z"),
          to: new Date("2026-12-31T00:00:00.000Z"),
        },
      };

      expect(getAdminFilterStatusMessage(DATE_RANGE_FILTER, value)).toBe(
        "시작일과 종료일이 선택되었습니다.",
      );
    });

    it("필터 정의와 값의 타입이 다르면 미선택 상태로 처리한다", () => {
      const value: AdminAppliedFilter<TestFilterField> = {
        field: "score",
        type: "number-range",
        value: {
          min: 0,
          max: 100,
        },
      };

      expect(getAdminFilterStatusMessage(DATE_RANGE_FILTER, value)).toBe(
        "선택된 날짜가 없습니다.",
      );
    });
  });
});
