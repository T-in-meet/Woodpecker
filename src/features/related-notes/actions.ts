"use server";

import { createClient } from "@/lib/supabase/server";

import {
  type AddManualRelatedNotesInput,
  addManualRelatedNotesSchema,
} from "./schemas";

export type AddManualRelatedNotesActionResult =
  | {
      success: true;
      error?: never;
    }
  | {
      success?: false;
      error: string;
    };

/**
 * 사용자가 선택한 Notes를 현재 Note의 manual Related Notes로 추가합니다.
 *
 * 이 Action은 Client 입력 검증과 RPC 호출만 담당합니다.
 *
 * 선택된 Related Notes는 한 번의 RPC 호출로 전달하며,
 * 다음 관계 규칙과 저장 처리는 `add_note_related_manual` RPC에서
 * 하나의 DB 작업으로 처리합니다.
 *
 * - 인증 사용자 확인
 * - source/target Note 소유권 검증
 * - 자기 자신 연결 방지
 * - 기존 AI/dismissed 관계의 manual + active 전환
 * - 대상 Note title snapshot 조회
 * - metadata의 title/reason 저장
 *
 * @param input 수동 Related Notes 추가 입력
 * @returns 전체 추가 성공 여부
 */
export async function addManualRelatedNotesAction(
  input: AddManualRelatedNotesInput,
): Promise<AddManualRelatedNotesActionResult> {
  const parsed = addManualRelatedNotesSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors.relatedNotes?.[0] ??
        "관련 노트 추가 정보가 올바르지 않습니다.",
    };
  }

  const { noteId, relatedNotes } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.rpc("add_note_related_manual", {
    p_note_id: noteId,
    p_related_notes: relatedNotes,
  });

  if (error) {
    /*
     * 자기 자신 연결은 정상 UI에서는 발생하지 않지만,
     * RPC를 직접 호출하거나 Client 상태가 잘못된 경우에도 DB에서 차단합니다.
     */
    if (error.message.includes("RELATED_NOTE_SELF_RELATION_NOT_ALLOWED")) {
      return {
        error: "현재 노트는 관련 노트로 추가할 수 없습니다.",
      };
    }

    /*
     * source 또는 target Note가 존재하지 않거나 현재 사용자 소유가 아닌 경우
     * 동일한 메시지를 반환하여 다른 사용자의 Note 존재 여부를 노출하지 않습니다.
     */
    if (
      error.message.includes("RELATED_NOTE_SOURCE_NOT_FOUND") ||
      error.message.includes("RELATED_NOTE_TARGET_NOT_FOUND")
    ) {
      return {
        error: "추가할 노트를 찾을 수 없습니다.",
      };
    }

    if (error.message.includes("RELATED_NOTE_AUTHENTICATION_REQUIRED")) {
      return {
        error: "로그인이 필요합니다.",
      };
    }

    return {
      error: "관련 노트 추가에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  return {
    success: true,
  };
}

import {
  type UpdateManualRelatedNoteReasonInput,
  updateManualRelatedNoteReasonSchema,
} from "./schemas";

export type UpdateManualRelatedNoteReasonActionResult =
  | {
      success: true;
      error?: never;
    }
  | {
      success?: false;
      error: string;
    };

/**
 * manual Related Note의 선택적 연결 이유를 수정합니다.
 *
 * 이 Action은 Client 입력 검증과 RPC 호출만 담당합니다.
 *
 * 다음 규칙은 애플리케이션 계층에서 중복 구현하지 않고
 * `update_note_related_manual_reason` RPC에서 최종 검증합니다.
 *
 * - 인증 사용자 확인
 * - source/target Note 소유권 검증
 * - manual 관계 존재 여부 검증
 * - AI 관계 수정 방지
 * - 기존 metadata 유지
 * - reason 추가/수정/제거
 *
 * @param input manual Related Note reason 수정 입력
 * @returns 수정 성공 여부
 */
export async function updateManualRelatedNoteReasonAction(
  input: UpdateManualRelatedNoteReasonInput,
): Promise<UpdateManualRelatedNoteReasonActionResult> {
  const parsed = updateManualRelatedNoteReasonSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error:
        parsed.error.flatten().fieldErrors.reason?.[0] ??
        "관련 노트 수정 정보가 올바르지 않습니다.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_note_related_manual_reason", {
    p_note_id: parsed.data.noteId,
    p_related_note_id: parsed.data.relatedNoteId,
    ...(parsed.data.reason
      ? {
          p_reason: parsed.data.reason,
        }
      : {}),
  });

  if (error) {
    if (error.message.includes("RELATED_NOTE_AUTHENTICATION_REQUIRED")) {
      return {
        error: "로그인이 필요합니다.",
      };
    }

    if (
      error.message.includes("RELATED_NOTE_SOURCE_NOT_FOUND") ||
      error.message.includes("RELATED_NOTE_TARGET_NOT_FOUND") ||
      error.message.includes("RELATED_NOTE_MANUAL_RELATION_NOT_FOUND")
    ) {
      return {
        error: "수정할 관련 노트를 찾을 수 없습니다.",
      };
    }

    if (error.message.includes("RELATED_NOTE_REASON_TOO_LONG")) {
      return {
        error: "연결 이유는 500자 이하로 입력해주세요.",
      };
    }

    return {
      error: "관련 노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  return {
    success: true,
  };
}
