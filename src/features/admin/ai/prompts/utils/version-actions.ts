import type { AdminAiPromptVersionStatus } from "../types";

/** Prompt Version에서 수행할 수 있는 관리자 lifecycle 작업입니다. */
export type AdminAiPromptVersionAction =
  | "archive"
  | "delete"
  | "publish"
  | "republish";

/** Prompt Version lifecycle에 따른 편집 가능 필드 정책입니다. */
export type AdminAiPromptVersionEditPolicy = {
  /** Template을 제외한 관리 필드를 수정할 수 있는지 여부입니다. */
  canEditMetadata: boolean;

  /** System/User Template을 수정할 수 있는지 여부입니다. */
  canEditTemplate: boolean;
};

/**
 * Prompt Version의 lifecycle 상태에 따라 편집 가능 필드 정책을 반환합니다.
 *
 * Draft Version은 모든 필드를 수정할 수 있고, Published Version은 배포 이력
 * 보호를 위해 Template을 제외한 관리 필드만 수정할 수 있습니다. Archived
 * Version은 수정할 수 없습니다.
 *
 * @param lifecycleStatus Prompt Version lifecycle 상태
 * @returns 편집 가능 필드 정책
 */
export function getAdminAiPromptVersionEditPolicy(
  lifecycleStatus: AdminAiPromptVersionStatus,
): AdminAiPromptVersionEditPolicy {
  if (lifecycleStatus === "draft") {
    return {
      canEditMetadata: true,
      canEditTemplate: true,
    };
  }

  if (lifecycleStatus === "published") {
    return {
      canEditMetadata: true,
      canEditTemplate: false,
    };
  }

  return {
    canEditMetadata: false,
    canEditTemplate: false,
  };
}

/**
 * Prompt Version의 lifecycle 상태에 따라 허용할 작업을 반환합니다.
 *
 * Draft와 Archived Version은 삭제할 수 있으며,
 * Published Version은 배포 이력 보호를 위해 삭제를 허용하지 않습니다.
 *
 * @param lifecycleStatus Prompt Version lifecycle 상태
 * @returns 허용된 Prompt Version lifecycle 작업 목록
 */
export function getAdminAiPromptVersionActions(
  lifecycleStatus: AdminAiPromptVersionStatus,
): AdminAiPromptVersionAction[] {
  if (lifecycleStatus === "draft") {
    return ["publish", "delete"];
  }

  if (lifecycleStatus === "published") {
    return ["archive"];
  }

  return ["republish", "delete"];
}
