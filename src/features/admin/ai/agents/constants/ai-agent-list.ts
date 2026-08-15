import { AdminListConfig } from "@/features/admin/types/list";
import { AdminSort } from "@/features/admin/types/sort";

import {
  AdminAiAgentFilterField,
  AdminAiAgentSearchField,
  AdminAiAgentSortField,
} from "../types";

/** AI agent 목록 초기 정렬 조건입니다. */
const ADMIN_AI_AGENT_INITIAL_SORT: AdminSort<AdminAiAgentSortField> = {
  field: "updatedAt",
  direction: "desc",
};

/** 관리자 AI agent 목록 설정입니다. */
export const ADMIN_AI_AGENT_LIST_CONFIG = {
  search: {
    initialField: "displayName",
    fields: [
      { value: "displayName", label: "이름" },
      { value: "purpose", label: "목적" },
    ],
  },
  filters: [
    {
      field: "familyCount",
      label: "Family 수",
      min: 0,
      placeholder: "Family 수 범위를 입력하세요.",
      step: 1,
      type: "number-range",
    },
    {
      field: "createdAt",
      label: "생성일",
      placeholder: "생성일 범위를 선택하세요.",
      type: "date-range",
    },
    {
      field: "updatedAt",
      label: "수정일",
      placeholder: "수정일 범위를 선택하세요.",
      type: "date-range",
    },
  ],
  initialSort: ADMIN_AI_AGENT_INITIAL_SORT,
  pagination: {
    pageSize: 10,
    pageCount: 5,
  },
} as const satisfies AdminListConfig<
  AdminAiAgentSearchField,
  AdminAiAgentFilterField,
  AdminAiAgentSortField
>;

/** AI agent 정렬 필드와 DB 컬럼 매핑입니다. */
export const ADMIN_AI_AGENT_SORT_COLUMN: Record<AdminAiAgentSortField, string> =
  {
    createdAt: "created_at",
    displayName: "display_name",
    familyCount: "family_count",
    updatedAt: "updated_at",
  };
