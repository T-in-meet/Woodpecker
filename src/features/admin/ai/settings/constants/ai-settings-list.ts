import { ADMIN_PAGINATION } from "@/features/admin/constants/admin-pagination";
import { ADMIN_SORT_DIRECTION } from "@/features/admin/constants/admin-sort";
import type { AdminBadgeColor } from "@/features/admin/types/badge";
import type { AdminFilterOption } from "@/features/admin/types/filter";
import type { AdminListConfig } from "@/features/admin/types/list";
import type { AdminSort } from "@/features/admin/types/sort";

import {
  AdminAiSettingFilterField,
  AdminAiSettingSearchField,
  AdminAiSettingSortField,
} from "../types/ai-settings-list";

/**
 * 관리자 AI 설정 목록의 초기 정렬 조건입니다.
 */
export const ADMIN_AI_SETTING_INITIAL_SORT: AdminSort<AdminAiSettingSortField> =
  {
    field: "updatedAt",
    direction: ADMIN_SORT_DIRECTION.DESC,
  };

/**
 * 관리자 AI 설정 목록의 Agent 배지 색상입니다.
 */
export const ADMIN_AI_SETTING_AGENT_BADGE_COLOR: AdminBadgeColor = "purple";

/**
 * 관리자 AI 설정 목록의 Chat Model 배지 색상입니다.
 */
export const ADMIN_AI_SETTING_CHAT_MODEL_BADGE_COLOR: AdminBadgeColor = "blue";

/**
 * 관리자 AI 설정 목록의 Embedding Model 배지 색상입니다.
 */
export const ADMIN_AI_SETTING_EMBEDDING_MODEL_BADGE_COLOR: AdminBadgeColor =
  "green";

type CreateAdminAiSettingListConfigParams = {
  /** Chat 모델 필터에서 선택 가능한 모델 목록 */
  chatModelOptions: readonly AdminFilterOption[];

  /** Embedding 모델 필터에서 선택 가능한 모델 목록 */
  embeddingModelOptions: readonly AdminFilterOption[];
};

/**
 * 관리자 AI 설정 목록에서 사용하는 검색, 필터, 정렬 및 페이지네이션
 * 설정을 생성합니다.
 *
 * Chat 및 Embedding 모델 목록은 DB에서 조회되므로 외부에서 전달받습니다.
 *
 * @param params AI 모델 필터 선택 항목
 * @returns 관리자 AI 설정 목록 설정
 */
export function createAdminAiSettingListConfig({
  chatModelOptions,
  embeddingModelOptions,
}: CreateAdminAiSettingListConfigParams): AdminListConfig<
  AdminAiSettingSearchField,
  AdminAiSettingFilterField,
  AdminAiSettingSortField
> {
  return {
    search: {
      initialField: "displayName",
      fields: [
        {
          value: "displayName",
          label: "설정 이름",
        },
        {
          value: "key",
          label: "설정 키",
        },
        {
          value: "agent",
          label: "Agent",
        },
      ],
    },

    filters: [
      {
        field: "chatModel",
        label: "Chat 모델",
        type: "multi-select",
        placeholder: "Chat 모델을 선택하세요.",
        options: chatModelOptions,
      },
      {
        field: "chatConfigurationCount",
        label: "Chat 구성 수",
        type: "number-range",
        min: 0,
        step: 1,
      },
      {
        field: "embeddingModel",
        label: "Embedding 모델",
        type: "multi-select",
        placeholder: "Embedding 모델을 선택하세요.",
        options: embeddingModelOptions,
      },
      {
        field: "embeddingConfigurationCount",
        label: "Embedding 구성 수",
        type: "number-range",
        min: 0,
        step: 1,
      },
      {
        field: "createdAt",
        label: "생성일",
        type: "date-range",
        placeholder: "생성일 범위를 선택하세요.",
      },
      {
        field: "updatedAt",
        label: "수정일",
        type: "date-range",
        placeholder: "수정일 범위를 선택하세요.",
      },
    ],

    initialSort: ADMIN_AI_SETTING_INITIAL_SORT,

    pagination: {
      pageSize: ADMIN_PAGINATION.DEFAULT_PAGE_SIZE,
      pageCount: 5,
    },
  };
}
