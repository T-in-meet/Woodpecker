import { AdminListToolbarFilters } from "../../hooks/use-admin-list-toolbar";
import { AdminSort } from "../../types/sort";
import {
  AdminAiAgentRow,
  AdminAiListResult,
  AdminAiPromptFamilyRow,
} from "../types";

/** 관리자 AI agent 목록 행입니다. */
export type AdminAiAgentListRow = {
  id: string;
  displayName: string;
  purpose: string | null;
  familyCount: number;
  createdAt: string;
  updatedAt: string;
};

/** AI agent 목록 검색 필드입니다. */
export type AdminAiAgentSearchField = "displayName" | "purpose";

/** AI agent 목록 필터 필드입니다. */
export type AdminAiAgentFilterField = "createdAt" | "familyCount" | "updatedAt";

/** AI agent 목록 정렬 필드입니다. */
export type AdminAiAgentSortField =
  | "createdAt"
  | "displayName"
  | "familyCount"
  | "updatedAt";

/** AI agent 목록 조회 조건입니다. */
export type AdminAiAgentListQuery = {
  page: number;
  pageSize: number;
  search: {
    field: AdminAiAgentSearchField;
    query: string;
  };
  filters: AdminListToolbarFilters<AdminAiAgentFilterField>;
  sort: AdminSort<AdminAiAgentSortField>;
};

/** 관리자 AI agent 목록 결과입니다. */
export type AdminAiAgentListResult = AdminAiListResult<AdminAiAgentListRow>;

/** 관리자 AI agent 상세입니다. */
export type AdminAiAgentDetail = AdminAiAgentRow & {
  families: AdminAiPromptFamilyRow[];
};
