import type { AdminListConfig } from "@/features/admin/types/list";
import type { AdminSort } from "@/features/admin/types/sort";

import type {
  AdminAiPromptFilterField,
  AdminAiPromptSearchField,
  AdminAiPromptSortField,
} from "../types";

/** AI prompt 목록 초기 정렬 조건입니다. */
const ADMIN_AI_PROMPT_INITIAL_SORT: AdminSort<AdminAiPromptSortField> = {
  field: "updatedAt",
  direction: "desc",
};

/** 관리자 AI prompt 목록 설정입니다. */
export const ADMIN_AI_PROMPT_LIST_CONFIG = {
  search: {
    initialField: "displayName",
    fields: [
      { value: "displayName", label: "이름" },
      { value: "agentDisplayName", label: "Agent" },
    ],
  },
  filters: [
    {
      field: "agentId",
      label: "Agent",
      type: "multi-select",
      placeholder: "Agent를 선택하세요.",
      options: [],
    },
    {
      field: "draftVersionCount",
      label: "Draft 수",
      min: 0,
      placeholder: "Draft 수 범위를 입력하세요.",
      step: 1,
      type: "number-range",
    },
    {
      field: "publishedVersionCount",
      label: "Published 수",
      min: 0,
      placeholder: "Published 수 범위를 입력하세요.",
      step: 1,
      type: "number-range",
    },
    {
      field: "archivedVersionCount",
      label: "Archived 수",
      min: 0,
      placeholder: "Archived 수 범위를 입력하세요.",
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
  initialSort: ADMIN_AI_PROMPT_INITIAL_SORT,
  pagination: {
    pageSize: 10,
    pageCount: 5,
  },
} as const satisfies AdminListConfig<
  AdminAiPromptSearchField,
  AdminAiPromptFilterField,
  AdminAiPromptSortField
>;

/** AI prompt 정렬 필드와 DB 컬럼 매핑입니다. */
export const ADMIN_AI_PROMPT_SORT_COLUMN: Record<
  AdminAiPromptSortField,
  string
> = {
  agentDisplayName: "agent_display_name",
  archivedVersionCount: "archived_version_count",
  createdAt: "created_at",
  displayName: "display_name",
  draftVersionCount: "draft_version_count",
  publishedVersionCount: "published_version_count",
  updatedAt: "updated_at",
};
