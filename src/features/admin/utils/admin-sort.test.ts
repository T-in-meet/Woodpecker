import { describe, expect, it } from "vitest";

import { ADMIN_SORT_DIRECTION } from "../constants/admin-sort";
import { getNextAdminSortDirection } from "./admin-sort";

describe("getNextAdminSortDirection", () => {
  it("오름차순을 내림차순으로 전환합니다", () => {
    const result = getNextAdminSortDirection(ADMIN_SORT_DIRECTION.ASC);

    expect(result).toBe(ADMIN_SORT_DIRECTION.DESC);
  });

  it("내림차순을 오름차순으로 전환합니다", () => {
    const result = getNextAdminSortDirection(ADMIN_SORT_DIRECTION.DESC);

    expect(result).toBe(ADMIN_SORT_DIRECTION.ASC);
  });
});
