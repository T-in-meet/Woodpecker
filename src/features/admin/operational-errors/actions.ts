"use server";

import {
  ADMIN_OPERATIONAL_ERROR_CODES,
  ADMIN_OPERATIONAL_ERROR_OPERATIONS,
  ADMIN_OPERATIONAL_ERROR_STAGES,
  OPERATIONAL_ERROR_STATUS,
  type OperationalErrorStatusType,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";
import { recordAdminOperationalError } from "./utils/record-admin-operational-error";

/** 운영 오류 처리 메모의 최대 입력 길이 */
const MAX_RESOLUTION_NOTE_LENGTH = 2_000;

const UPDATE_OPERATIONAL_ERROR_STATUS_RPC_RESULT = {
  NO_CHANGES: "NO_CHANGES",
  NOT_FOUND: "NOT_FOUND",
  OK: "OK",
  OPEN_DUPLICATE: "OPEN_DUPLICATE",
} as const;

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

function mapRpcResultToActionResult(
  result: string | null,
): UpdateOperationalErrorStatusResult {
  if (result === UPDATE_OPERATIONAL_ERROR_STATUS_RPC_RESULT.OK) {
    return { ok: true };
  }

  if (result === UPDATE_OPERATIONAL_ERROR_STATUS_RPC_RESULT.OPEN_DUPLICATE) {
    return {
      message:
        "같은 오류가 이미 재발해 미해결 항목으로 추적 중입니다. 새 항목에서 처리해주세요.",
      ok: false,
    };
  }

  if (result === UPDATE_OPERATIONAL_ERROR_STATUS_RPC_RESULT.NO_CHANGES) {
    return {
      message: "변경할 상태 또는 처리 메모를 입력해주세요.",
      ok: false,
    };
  }

  return {
    message: "운영 오류를 찾을 수 없습니다.",
    ok: false,
  };
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

  const { data, error } = await supabase.rpc(
    "update_operational_error_status_with_history",
    {
      p_admin_user_id: adminUserId,
      p_operational_error_id: operationalErrorId,
      p_resolution_note: normalizedNote,
      p_status: status,
    },
  );

  if (error) {
    await recordAdminOperationalError({
      actorUserId: adminUserId,
      code: ADMIN_OPERATIONAL_ERROR_CODES.OPERATIONAL_ERROR_STATUS_UPDATE_FAILED,
      context: {
        hasNote: normalizedNote.length > 0,
        operationalErrorId,
        toStatus: status,
      },
      error,
      message: "운영 오류 상태 변경과 처리 이력 저장에 실패했습니다.",
      operation:
        ADMIN_OPERATIONAL_ERROR_OPERATIONS.UPDATE_OPERATIONAL_ERROR_STATUS,
      stage: ADMIN_OPERATIONAL_ERROR_STAGES.STATUS_UPDATE,
    });

    return {
      message: "운영 오류 상태 변경에 실패했습니다.",
      ok: false,
    };
  }

  return mapRpcResultToActionResult(data);
}
