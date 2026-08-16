import type { Json } from "@/types/db.helpers";

import { AdminAiPromptVersionStatus } from "./prompts/types";

/** 관리자 AI mutation 결과입니다. */
export type AdminAiActionResult =
  | {
      id?: string;
      message?: string;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

/**
 * 관리자 Prompt 그래프 조회 결과입니다.
 *
 * Agent, Family, Family별 Version 목록을 한 번에 묶어 관리자 Prompt 관리와
 * Agent 상세 화면에서 사용할 수 있도록 제공합니다.
 */
export type AiPromptGraph = {
  agents: AdminAiAgentRow[];
  families: AdminAiPromptFamilyRow[];
  versionsByFamilyId: Map<string, AdminAiPromptVersionRow[]>;
};

/** 관리자 AI agent 목록 행입니다. */
export type AdminAiAgentRow = {
  id: string;
  displayName: string;
  description: string | null;
  purpose: string | null;
  tags: string[];
  familyCount: number;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
};

/** 관리자 AI prompt family 목록 행입니다. */
export type AdminAiPromptFamilyRow = {
  id: string;
  agentDisplayName: string;
  agentId: string;
  displayName: string;
  description: string | null;
  tags: string[];
  draftVersionCount: number;
  publishedVersionCount: number;
  archivedVersionCount: number;
  createdAt: string;
  updatedAt: string;
};

/** 관리자 AI prompt version 목록 행입니다. */
export type AdminAiPromptVersionRow = {
  id: string;
  familyId: string;
  versionNumber: number;
  displayName: string;
  changeSummary: string | null;
  lifecycleStatus: AdminAiPromptVersionStatus;
  systemTemplate: string;
  userTemplate: string;
  responseSchema: Json;
  variables: Json;
  tags: string[];
  createdByKind: string;
  createdBy: string | null;
  createdAt: string;
};

/** 관리자 AI 목록 페이지네이션 메타데이터입니다. */
type AdminAiListPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** 관리자 AI 목록 결과입니다. */
export type AdminAiListResult<TItem> = {
  items: TItem[];
  pagination: AdminAiListPagination;
};
