import { AdminListToolbarFilters } from "../../hooks/use-admin-list-toolbar";
import { AdminSort } from "../../types/sort";
import {
  AdminAiListResult,
  AdminAiPromptFamilyRow,
  AdminAiPromptVersionRow,
} from "../types";

/** 관리자 AI prompt family 목록 행입니다. */
export type AdminAiPromptFamilyListRow = {
  id: string;
  agentId: string;
  agentDisplayName: string;
  displayName: string;
  draftVersionCount: number;
  publishedVersionCount: number;
  archivedVersionCount: number;
  createdAt: string;
  updatedAt: string;
};

/** AI prompt family 목록 검색 필드입니다. */
export type AdminAiPromptSearchField = "agentDisplayName" | "displayName";

/** AI prompt family 목록 필터 필드입니다. */
export type AdminAiPromptFilterField =
  | "agentId"
  | "archivedVersionCount"
  | "createdAt"
  | "draftVersionCount"
  | "publishedVersionCount"
  | "updatedAt";

/** AI prompt family 목록 정렬 필드입니다. */
export type AdminAiPromptSortField =
  | "agentDisplayName"
  | "archivedVersionCount"
  | "createdAt"
  | "displayName"
  | "draftVersionCount"
  | "publishedVersionCount"
  | "updatedAt";

/** AI prompt version lifecycle status입니다. */
export type AdminAiPromptVersionStatus = "draft" | "published" | "archived";

/** AI prompt family 목록 조회 조건입니다. */
export type AdminAiPromptListQuery = {
  page: number;
  pageSize: number;
  search: {
    field: AdminAiPromptSearchField;
    query: string;
  };
  filters: AdminListToolbarFilters<AdminAiPromptFilterField>;
  sort: AdminSort<AdminAiPromptSortField>;
};

/** 관리자 AI prompt 목록 결과입니다. */
export type AdminAiPromptListResult =
  AdminAiListResult<AdminAiPromptFamilyListRow>;

/** 관리자 AI prompt family 상세입니다. */
export type AdminAiPromptFamilyDetail = AdminAiPromptFamilyRow & {
  versions: AdminAiPromptVersionRow[];
};

/** 관리자 AI Prompt Family 선택 항목입니다. */
export type AdminAiPromptFamilyOption = {
  /** Prompt Family가 속한 Agent ID입니다. */
  agentId: string;

  /** Prompt Family 표시 이름입니다. */
  displayName: string;

  /** Prompt Family ID입니다. */
  id: string;
};

/** 관리자 AI Prompt Version 선택 항목입니다. */
export type AdminAiPromptVersionOption = {
  /** Prompt Version 표시 이름입니다. */
  displayName: string;

  /** Prompt Version이 속한 Family ID입니다. */
  familyId: string;

  /** Prompt Version ID입니다. */
  id: string;

  /** Prompt Version 번호입니다. */
  versionNumber: number;
};
