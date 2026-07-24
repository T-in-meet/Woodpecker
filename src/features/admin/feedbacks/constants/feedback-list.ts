import type { AdminListConfig } from "@/features/admin/types/list";

import type {
  FeedbackFilterField,
  FeedbackSearchField,
} from "../types/feedback-list";

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

  pagination: {
    pageSize: 10,
    pageCount: 5,
  },
} as const satisfies AdminListConfig<FeedbackSearchField, FeedbackFilterField>;
