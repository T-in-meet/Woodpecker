import {
  AiModelCapability,
  AiModelProvider,
} from "@/features/ai/constants/models";

import { AdminListToolbarFilters } from "../../hooks/use-admin-list-toolbar";
import { AdminSort } from "../../types/sort";
import { AdminAiListResult } from "../types";

/** 관리자 AI 모델 목록 행입니다. */
export type AdminAiModelListRow = {
  id: string;
  displayName: string;
  provider: AiModelProvider;
  model: string;
  capability: AiModelCapability;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  embeddingReferenceCount: number;
};

/** 관리자 AI 모델 상세 행입니다. */
export type AdminAiModelRow = AdminAiModelListRow & {
  dimensions: number | null;
  distanceMetric: string | null;
  notes: string | null;
};

/** AI 모델 목록 검색 필드입니다. */
export type AdminAiModelSearchField = "displayName" | "model";

/** AI 모델 목록 필터 필드입니다. */
export type AdminAiModelFilterField =
  | "capability"
  | "createdAt"
  | "embeddingReferenceCount"
  | "isActive"
  | "provider"
  | "updatedAt";

/** AI 모델 목록 정렬 필드입니다. */
export type AdminAiModelSortField =
  | "capability"
  | "createdAt"
  | "displayName"
  | "embeddingReferenceCount"
  | "model"
  | "provider"
  | "updatedAt";

/** AI 모델 목록 조회 조건입니다. */
export type AdminAiModelListQuery = {
  page: number;
  pageSize: number;
  search: {
    field: AdminAiModelSearchField;
    query: string;
  };
  filters: AdminListToolbarFilters<AdminAiModelFilterField>;
  sort: AdminSort<AdminAiModelSortField>;
};

/** 관리자 AI 모델 목록 결과입니다. */
export type AdminAiModelListResult = AdminAiListResult<AdminAiModelListRow>;

/** AI 모델 설정 선택 옵션입니다. */
export type AdminAiModelConfigOption = {
  /** AI 모델 설정 ID입니다. */
  id: string;

  /** 관리자 화면에 표시할 설정 이름입니다. */
  displayName: string;

  /** 모델 제공자입니다. */
  provider: AiModelProvider;

  /** 모델 식별자입니다. */
  model: string;

  /** 모델이 지원하는 기능입니다. */
  capability: AiModelCapability;

  /** 모델 설정 활성 여부입니다. */
  isActive: boolean;
};
