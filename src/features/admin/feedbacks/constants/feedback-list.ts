import type { AdminListConfig } from "@/features/admin/types/list";

import { AdminBadgeConfig } from "../../types/badge";
import type { AdminSort } from "../../types/sort";
import type {
  FeedbackCategory,
  FeedbackFilterField,
  FeedbackSearchField,
  FeedbackSortField,
  FeedbackStatus,
} from "../types/feedback-list";

/**
 * 관리자 피드백 목록의 초기 정렬 조건입니다.
 */
const ADMIN_FEEDBACK_INITIAL_SORT: AdminSort<FeedbackSortField> = {
  field: "createdAt",
  direction: "desc",
};

/**
 * 관리자 피드백 목록에서 사용하는 검색, 필터, 페이지네이션 설정입니다.
 *
 * 공통 AdminListToolbar와 AdminPagination이 이 설정을 공유하므로,
 * 목록 조회 action의 query 타입과 항상 같은 필드 이름을 사용해야 합니다.
 */
export const ADMIN_FEEDBACK_LIST_CONFIG = {
  search: {
    initialField: "title",
    fields: [
      {
        value: "title",
        label: "제목",
      },
      {
        value: "content",
        label: "내용",
      },
      {
        value: "user",
        label: "사용자",
      },
    ],
  },

  filters: [
    {
      field: "category",
      label: "카테고리",
      type: "multi-select",
      placeholder: "카테고리를 선택하세요.",
      options: [
        {
          value: "BUG",
          label: "버그",
        },
        {
          value: "FEATURE",
          label: "기능 요청",
        },
        {
          value: "ETC",
          label: "기타",
        },
      ],
    },
    {
      field: "status",
      label: "상태",
      type: "multi-select",
      placeholder: "상태를 선택하세요.",
      options: [
        {
          value: "OPEN",
          label: "미해결",
        },
        {
          value: "RESOLVED",
          label: "해결",
        },
      ],
    },
    {
      field: "createdAt",
      label: "등록일",
      type: "date-range",
      placeholder: "등록일 범위를 선택하세요.",
    },
    {
      field: "hasImages",
      label: "첨부",
      type: "select",
      placeholder: "첨부 여부를 선택하세요.",
      options: [
        {
          value: "yes",
          label: "있음",
        },
        {
          value: "no",
          label: "없음",
        },
      ],
    },
    {
      field: "noteLinked",
      label: "노트 연결",
      type: "select",
      placeholder: "노트 연결 여부를 선택하세요.",
      options: [
        {
          value: "yes",
          label: "연결됨",
        },
        {
          value: "no",
          label: "연결 없음",
        },
      ],
    },
  ],

  initialSort: ADMIN_FEEDBACK_INITIAL_SORT,

  pagination: {
    pageSize: 10,
    pageCount: 5,
  },
} as const satisfies AdminListConfig<
  FeedbackSearchField,
  FeedbackFilterField,
  FeedbackSortField
>;

export const FEEDBACK_CATEGORY_BADGE_CONFIG = {
  BUG: {
    label: "버그",
    color: "red",
  },
  FEATURE: {
    label: "기능 요청",
    color: "blue",
  },
  ETC: {
    label: "기타",
    color: "gray",
  },
} satisfies AdminBadgeConfig<FeedbackCategory>;

export const FEEDBACK_STATUS_BADGE_CONFIG = {
  OPEN: {
    label: "미해결",
    color: "yellow",
  },
  RESOLVED: {
    label: "해결",
    color: "green",
  },
} satisfies AdminBadgeConfig<FeedbackStatus>;

/**
 * feedbacks 테이블에서 직접 정렬할 수 있는 컬럼입니다.
 */
type FeedbackSortColumn = "status" | "category" | "title" | "created_at";

/**
 * 관리자 피드백 정렬 필드와 feedbacks 테이블 컬럼 간의 대응 관계입니다.
 *
 * 사용자, 첨부 개수, 연결 노트처럼 관계 데이터 또는 계산값을 사용하는
 * 정렬 필드는 포함하지 않습니다.
 */
export const ADMIN_FEEDBACK_SORT_COLUMN: Partial<
  Record<FeedbackSortField, FeedbackSortColumn>
> = {
  status: "status",
  category: "category",
  title: "title",
  createdAt: "created_at",
};
