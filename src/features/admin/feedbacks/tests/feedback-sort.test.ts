import { describe, expect, it, vi } from "vitest";

import { ADMIN_SORT_DIRECTION } from "@/features/admin/constants/admin-sort";

import type {
  AdminFeedbackListItem,
  FeedbackSortField,
} from "../types/feedback-list";
import {
  applyFeedbackSort,
  needsFeedbackItemSort,
  sortFeedbackItems,
} from "../utils/feedback-sort";

function createFeedbackItem(
  overrides: Partial<AdminFeedbackListItem> = {},
): AdminFeedbackListItem {
  return {
    id: "feedback-1",
    userId: "user-1",
    userLabel: "사용자",
    userEmail: "user@example.com",
    replyAuthorId: null,
    replyAuthorLabel: null,
    noteId: null,
    noteTitle: null,
    category: "BUG",
    status: "OPEN",
    title: "피드백",
    contentPreview: "본문",
    imageCount: 0,
    createdAt: "2026-07-25T10:00:00.000Z",
    updatedAt: "2026-07-25T10:00:00.000Z",
    ...overrides,
  };
}

function createQueryMock() {
  const query = {
    order: vi.fn(),
  };

  query.order.mockReturnValue(query);

  return query;
}

describe("applyFeedbackSort", () => {
  it("직접 정렬 가능한 필드는 대응하는 DB 컬럼으로 오름차순 정렬한다", () => {
    const query = createQueryMock();

    const result = applyFeedbackSort(query as never, {
      field: "title",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    expect(query.order).toHaveBeenCalledWith("title", {
      ascending: true,
    });
    expect(result).toBe(query);
  });

  it("직접 정렬 가능한 필드는 내림차순 조건을 적용한다", () => {
    const query = createQueryMock();

    applyFeedbackSort(query as never, {
      field: "createdAt",
      direction: ADMIN_SORT_DIRECTION.DESC,
    });

    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("DB에서 직접 정렬할 수 없는 필드는 조회 객체를 변경하지 않는다", () => {
    const query = createQueryMock();

    const result = applyFeedbackSort(query as never, {
      field: "user",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    expect(query.order).not.toHaveBeenCalled();
    expect(result).toBe(query);
  });
});

describe("needsFeedbackItemSort", () => {
  it.each([
    "user",
    "imageCount",
    "replyAuthor",
    "note",
  ] satisfies FeedbackSortField[])(
    "%s 필드는 목록 변환 후 정렬이 필요하다",
    (field) => {
      expect(
        needsFeedbackItemSort({
          field,
          direction: ADMIN_SORT_DIRECTION.ASC,
        }),
      ).toBe(true);
    },
  );

  it.each([
    "status",
    "category",
    "title",
    "createdAt",
  ] satisfies FeedbackSortField[])(
    "%s 필드는 DB에서 직접 정렬할 수 있다",
    (field) => {
      expect(
        needsFeedbackItemSort({
          field,
          direction: ADMIN_SORT_DIRECTION.ASC,
        }),
      ).toBe(false);
    },
  );
});

describe("sortFeedbackItems", () => {
  it("사용자명을 오름차순과 내림차순으로 정렬한다", () => {
    const items = [
      createFeedbackItem({
        id: "feedback-1",
        userLabel: "하늘",
      }),
      createFeedbackItem({
        id: "feedback-2",
        userLabel: "가람",
      }),
    ];

    const ascending = sortFeedbackItems(items, {
      field: "user",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    const descending = sortFeedbackItems(items, {
      field: "user",
      direction: ADMIN_SORT_DIRECTION.DESC,
    });

    expect(ascending.map((item) => item.id)).toEqual([
      "feedback-2",
      "feedback-1",
    ]);
    expect(descending.map((item) => item.id)).toEqual([
      "feedback-1",
      "feedback-2",
    ]);
  });

  it("이미지 개수를 기준으로 정렬한다", () => {
    const items = [
      createFeedbackItem({
        id: "feedback-1",
        imageCount: 3,
      }),
      createFeedbackItem({
        id: "feedback-2",
        imageCount: 1,
      }),
      createFeedbackItem({
        id: "feedback-3",
        imageCount: 2,
      }),
    ];

    const result = sortFeedbackItems(items, {
      field: "imageCount",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    expect(result.map((item) => item.id)).toEqual([
      "feedback-2",
      "feedback-3",
      "feedback-1",
    ]);
  });

  it("nullable 텍스트는 null 값을 마지막에 배치한다", () => {
    const items = [
      createFeedbackItem({
        id: "feedback-1",
        replyAuthorLabel: null,
      }),
      createFeedbackItem({
        id: "feedback-2",
        replyAuthorLabel: "관리자 나",
      }),
      createFeedbackItem({
        id: "feedback-3",
        replyAuthorLabel: "관리자 가",
      }),
    ];

    const result = sortFeedbackItems(items, {
      field: "replyAuthor",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    expect(result.map((item) => item.id)).toEqual([
      "feedback-3",
      "feedback-2",
      "feedback-1",
    ]);
  });

  it("내림차순에서는 nullable 텍스트의 null 값이 앞에 배치된다", () => {
    const items = [
      createFeedbackItem({
        id: "feedback-1",
        noteTitle: null,
      }),
      createFeedbackItem({
        id: "feedback-2",
        noteTitle: "노트 가",
      }),
    ];

    const result = sortFeedbackItems(items, {
      field: "note",
      direction: ADMIN_SORT_DIRECTION.DESC,
    });

    expect(result.map((item) => item.id)).toEqual(["feedback-1", "feedback-2"]);
  });

  it("정렬 값이 같으면 최근 생성된 항목을 먼저 배치한다", () => {
    const items = [
      createFeedbackItem({
        id: "feedback-old",
        imageCount: 1,
        createdAt: "2026-07-24T10:00:00.000Z",
      }),
      createFeedbackItem({
        id: "feedback-new",
        imageCount: 1,
        createdAt: "2026-07-25T10:00:00.000Z",
      }),
    ];

    const result = sortFeedbackItems(items, {
      field: "imageCount",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    expect(result.map((item) => item.id)).toEqual([
      "feedback-new",
      "feedback-old",
    ]);
  });

  it("원본 배열을 변경하지 않는다", () => {
    const items = [
      createFeedbackItem({
        id: "feedback-1",
        imageCount: 2,
      }),
      createFeedbackItem({
        id: "feedback-2",
        imageCount: 1,
      }),
    ];

    const originalOrder = [...items];

    const result = sortFeedbackItems(items, {
      field: "imageCount",
      direction: ADMIN_SORT_DIRECTION.ASC,
    });

    expect(items).toEqual(originalOrder);
    expect(result).not.toBe(items);
  });
});
