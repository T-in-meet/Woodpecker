import { describe, expect, it, vi } from "vitest";

import { ADMIN_SORT_DIRECTION } from "@/features/admin/constants/admin-sort";

import type { FeedbackSortField } from "../types/feedback-list";
import { applyFeedbackSort } from "../utils/feedback-sort";

function createQueryMock() {
  const query = {
    order: vi.fn(),
  };

  query.order.mockReturnValue(query);

  return query;
}

describe("applyFeedbackSort", () => {
  it.each([
    {
      field: "status",
      column: "status",
    },
    {
      field: "category",
      column: "category",
    },
    {
      field: "title",
      column: "title",
    },
    {
      field: "createdAt",
      column: "created_at",
    },
  ] satisfies Array<{ field: FeedbackSortField; column: string }>)(
    "$field 정렬 필드를 대응하는 DB 컬럼으로 오름차순 정렬한다",
    ({ field, column }) => {
      const query = createQueryMock();

      const result = applyFeedbackSort(query as never, {
        field,
        direction: ADMIN_SORT_DIRECTION.ASC,
      });

      expect(query.order).toHaveBeenCalledWith(column, {
        ascending: true,
      });
      expect(result).toBe(query);
    },
  );

  it("내림차순 조건을 적용한다", () => {
    const query = createQueryMock();

    applyFeedbackSort(query as never, {
      field: "createdAt",
      direction: ADMIN_SORT_DIRECTION.DESC,
    });

    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });
});
