"use server";

import { revalidatePath } from "next/cache";

import {
  ADMIN_OPERATIONAL_ERROR_CODES,
  ADMIN_OPERATIONAL_ERROR_OPERATIONS,
  ADMIN_OPERATIONAL_ERROR_STAGES,
  OPERATIONAL_ERROR_STATUS,
  type OperationalErrorStatusType,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";
import { recordAdminOperationalError } from "./utils/record-admin-operational-error";

/** 운영 오류 처리 메모의 최대 입력 길이 */
const MAX_RESOLUTION_NOTE_LENGTH = 2_000;

export type UpdateOperationalErrorStatusResult =
  | { ok: true }
  | { message: string; ok: false };

/**
 * 전달된 값이 지원하는 운영 오류 상태인지 확인합니다.
 *
 * @param value 확인할 상태 값
 * @returns 운영 오류 상태이면 true
 */
function isOperationalErrorStatus(
  value: string,
): value is OperationalErrorStatusType {
  return Object.values(OPERATIONAL_ERROR_STATUS).includes(
    value as OperationalErrorStatusType,
  );
}

/**
 * 운영 오류의 상태를 변경하고 처리 이력을 저장합니다.
 *
 * 상태가 변경되지 않더라도 처리 메모가 입력된 경우에는
 * 새로운 처리 이력을 추가할 수 있습니다.
 *
 * @param operationalErrorId 상태를 변경할 운영 오류 ID
 * @param status 새로 적용할 운영 오류 상태
 * @param resolutionNote 이번 처리에 기록할 메모
 * @returns 상태 변경 및 이력 저장 결과
 */
export async function updateOperationalErrorStatus(
  operationalErrorId: string,
  status: string,
  resolutionNote: string,
): Promise<UpdateOperationalErrorStatusResult> {
  /** 관리자 권한을 확인하고 현재 관리자 ID를 조회합니다. */
  const adminUserId = await requireAdmin();

  /** 허용되지 않은 상태 값은 DB 조회 전에 차단합니다. */
  if (!isOperationalErrorStatus(status)) {
    return {
      message: "상태 값이 올바르지 않습니다.",
      ok: false,
    };
  }

  /** 처리 메모의 앞뒤 공백을 제거한 값을 저장에 사용합니다. */
  const normalizedNote = resolutionNote.trim();

  /** 지나치게 긴 처리 메모가 저장되지 않도록 제한합니다. */
  if (normalizedNote.length > MAX_RESOLUTION_NOTE_LENGTH) {
    return {
      message: `처리 메모는 ${MAX_RESOLUTION_NOTE_LENGTH.toLocaleString(
        "ko-KR",
      )}자 이하로 입력해주세요.`,
      ok: false,
    };
  }

  const supabase = createAdminClient();

  /**
   * 상태 변경 이력을 만들기 위해 현재 운영 오류의 상태를 먼저 조회합니다.
   *
   * 조회한 상태는 이력의 from_status 값과
   * 실제 변경 여부를 판단하는 데 사용합니다.
   */
  const { data: currentError, error: currentErrorError } = await supabase
    .from("operational_errors")
    .select("status")
    .eq("id", operationalErrorId)
    .maybeSingle();

  if (currentErrorError) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_STATUS_QUERY_FAILED,
      context: {
        operationalErrorId,
        requestedStatus: status,
      },
      error: currentErrorError,
      message: "운영 오류 현재 상태를 조회하지 못했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.UPDATE_OPERATIONAL_ERROR_STATUS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.CURRENT_STATUS_QUERY,
    });

    return {
      message: "운영 오류 조회에 실패했습니다.",
      ok: false,
    };
  }

  if (!currentError || !isOperationalErrorStatus(currentError.status)) {
    return {
      message: "운영 오류를 찾을 수 없습니다.",
      ok: false,
    };
  }

  /** 처리 이력에 저장할 메모가 있는지 확인합니다. */
  const hasNote = normalizedNote.length > 0;

  /** 기존 상태와 요청된 상태가 같은지 확인합니다. */
  const isStatusUnchanged = currentError.status === status;

  /**
   * 상태가 같고 새로운 메모도 없다면 실제 변경 사항이 없으므로
   * 불필요한 업데이트와 처리 이력 생성을 차단합니다.
   */
  if (isStatusUnchanged && !hasNote) {
    return {
      message: "변경할 상태 또는 처리 메모를 입력해주세요.",
      ok: false,
    };
  }

  /**
   * 미해결 상태로 변경하는 경우 해결 관련 정보를 초기화합니다.
   *
   * 해결 또는 무시 상태로 변경하는 경우에는
   * 마지막 처리 시각과 처리 관리자를 갱신합니다.
   */
  const resolvedFields =
    status === OPERATIONAL_ERROR_STATUS.OPEN
      ? {
          resolution_note: null,
          resolved_at: null,
          resolved_by: null,
        }
      : {
          resolution_note: hasNote ? normalizedNote : null,
          resolved_at: new Date().toISOString(),
          resolved_by: adminUserId,
        };

  /** 운영 오류의 현재 상태와 마지막 처리 정보를 갱신합니다. */
  const { error } = await supabase
    .from("operational_errors")
    .update({
      ...resolvedFields,
      status,
    })
    .eq("id", operationalErrorId);

  if (error) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_STATUS_UPDATE_FAILED,
      context: {
        fromStatus: currentError.status,
        hasNote,
        operationalErrorId,
        toStatus: status,
      },
      error,
      message: "운영 오류 상태를 변경하지 못했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.UPDATE_OPERATIONAL_ERROR_STATUS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.STATUS_UPDATE,
    });

    return {
      message: "운영 오류 상태 변경에 실패했습니다.",
      ok: false,
    };
  }

  /**
   * 이번 상태 변경 또는 처리 메모 작성을 별도의 이력으로 저장합니다.
   *
   * 상태가 변경되지 않고 메모만 추가된 경우에는
   * from_status와 to_status가 같은 이력이 생성됩니다.
   */
  const { error: historyError } = await supabase
    .from("operational_error_status_history")
    .insert({
      changed_by: adminUserId,
      from_status: currentError.status,
      note: hasNote ? normalizedNote : null,
      operational_error_id: operationalErrorId,
      to_status: status,
    });

  if (historyError) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_HISTORY_INSERT_FAILED,
      context: {
        fromStatus: currentError.status,
        hasNote,
        operationalErrorId,
        toStatus: status,
      },
      error: historyError,
      message: "운영 오류 처리 이력을 저장하지 못했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.UPDATE_OPERATIONAL_ERROR_STATUS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.STATUS_HISTORY_INSERT,
    });
    return {
      message: "운영 오류 처리 이력 저장에 실패했습니다.",
      ok: false,
    };
  }

  /** 서버에서 직접 접근하는 운영 오류 목록 경로의 캐시를 갱신합니다. */
  revalidatePath(ROUTES.ADMIN.OPERATIONAL_ERRORS);

  return { ok: true };
}
