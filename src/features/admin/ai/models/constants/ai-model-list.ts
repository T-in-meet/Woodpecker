import { AdminListConfig } from "@/features/admin/types/list";
import { AdminSort } from "@/features/admin/types/sort";

import {
  AdminAiModelFilterField,
  AdminAiModelSearchField,
  AdminAiModelSortField,
} from "../types";

/** AI 모델 목록 초기 정렬 조건입니다. */
const ADMIN_AI_MODEL_INITIAL_SORT: AdminSort<AdminAiModelSortField> = {
  field: "updatedAt",
  direction: "desc",
};

/** 관리자 AI 모델 목록 설정입니다. */
export const ADMIN_AI_MODEL_LIST_CONFIG = {
  search: {
    initialField: "displayName",
    fields: [
      { value: "displayName", label: "이름" },
      { value: "model", label: "모델" },
    ],
  },
  filters: [
    {
      field: "provider",
      label: "Provider",
      type: "multi-select",
      placeholder: "Provider를 선택하세요.",
      options: [
        { value: "openai", label: "OpenAI" },
        { value: "google", label: "Google" },
      ],
    },
    {
      field: "capability",
      label: "용도",
      type: "multi-select",
      placeholder: "용도를 선택하세요.",
      options: [
        { value: "embedding", label: "Embedding" },
        { value: "chat", label: "Chat" },
      ],
    },
    {
      field: "isActive",
      label: "활성 상태",
      type: "select",
      placeholder: "상태를 선택하세요.",
      options: [
        { value: "true", label: "Active" },
        { value: "false", label: "Inactive" },
      ],
    },
    {
      field: "embeddingReferenceCount",
      label: "참조 수",
      min: 0,
      placeholder: "참조 수 범위를 입력하세요.",
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
  initialSort: ADMIN_AI_MODEL_INITIAL_SORT,
  pagination: {
    pageSize: 10,
    pageCount: 5,
  },
} as const satisfies AdminListConfig<
  AdminAiModelSearchField,
  AdminAiModelFilterField,
  AdminAiModelSortField
>;

/** AI 모델 정렬 필드와 DB 컬럼 매핑입니다. */
export const ADMIN_AI_MODEL_SORT_COLUMN: Record<AdminAiModelSortField, string> =
  {
    capability: "capability",
    createdAt: "created_at",
    displayName: "display_name",
    embeddingReferenceCount: "embedding_reference_count",
    model: "model",
    provider: "provider",
    updatedAt: "updated_at",
  };
