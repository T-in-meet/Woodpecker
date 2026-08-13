import type { AdminAiPromptVersionStatus } from "../types";

/** Prompt Version에서 수행할 수 있는 관리자 lifecycle 작업입니다. */
export type AdminAiPromptVersionAction =
  | "archive"
  | "delete"
  | "publish"
  | "republish";

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
