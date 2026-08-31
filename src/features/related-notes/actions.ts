"use server";

import { redirect } from "next/navigation";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { type RelatedNoteRecommendationExecutionClaimStatus } from "./execution/execution-claim-persistence";
import { scheduleRelatedNoteRecommendation } from "./execution/schedule-related-note-recommendation";
import {
  type AddManualRelatedNotesInput,
  addManualRelatedNotesSchema,
  type DeleteRelatedNoteInput,
  deleteRelatedNoteSchema,
  type RequestRelatedNoteRecommendationInput,
  requestRelatedNoteRecommendationSchema,
  type UpdateManualRelatedNoteReasonInput,
  updateManualRelatedNoteReasonSchema,
} from "./schemas";

/** 수동 Related Notes 추가 대상이 비어 있거나 배열이 아닌 경우의 SQLSTATE입니다. */
const RELATED_NOTE_TARGET_REQUIRED_SQLSTATE = "WP004";

/** 수동 Related Notes 추가 대상 형식이 올바르지 않은 경우의 SQLSTATE입니다. */
const RELATED_NOTE_TARGET_INVALID_SQLSTATE = "WP005";

/** 수동 Related Notes 추가 대상에 중복 ID가 포함된 경우의 SQLSTATE입니다. */
const RELATED_NOTE_TARGET_DUPLICATED_SQLSTATE = "WP006";

/** 현재 Note 자신을 Related Note로 추가하려는 경우의 SQLSTATE입니다. */
const RELATED_NOTE_SELF_RELATION_NOT_ALLOWED_SQLSTATE = "WP007";

/** 수동 Related Notes 연결 이유가 허용 길이를 초과한 경우의 SQLSTATE입니다. */
const RELATED_NOTE_REASON_TOO_LONG_SQLSTATE = "WP008";

/** 수동 Related Notes 추가 대상 개수가 허용 상한을 초과한 경우의 SQLSTATE입니다. */
const RELATED_NOTE_TARGET_TOO_MANY_SQLSTATE = "WP009";

/** source 또는 target Note를 찾을 수 없는 경우 RPC가 반환하는 SQLSTATE입니다. */
const RELATED_NOTE_NOT_FOUND_SQLSTATE = "P0002";

/** 인증되지 않은 사용자가 RPC를 호출한 경우의 SQLSTATE입니다. */
const RELATED_NOTE_AUTHENTICATION_REQUIRED_SQLSTATE = "42501";

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
 * - metadata의 reason 저장
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  await requireCurrentLegalAcceptance(user.id, getNoteDetailRoute(noteId));

  const { error } = await supabase.rpc("add_note_related_manual", {
    p_note_id: noteId,
    p_related_notes: relatedNotes,
  });

  if (error) {
    if (error.code === RELATED_NOTE_SELF_RELATION_NOT_ALLOWED_SQLSTATE) {
      return {
        error: "현재 노트는 관련 노트로 추가할 수 없습니다.",
      };
    }

    if (error.code === RELATED_NOTE_NOT_FOUND_SQLSTATE) {
      return {
        error: "추가할 노트를 찾을 수 없습니다.",
      };
    }

    if (error.code === RELATED_NOTE_AUTHENTICATION_REQUIRED_SQLSTATE) {
      return {
        error: "로그인이 필요합니다.",
      };
    }

    if (
      error.code === RELATED_NOTE_TARGET_REQUIRED_SQLSTATE ||
      error.code === RELATED_NOTE_TARGET_INVALID_SQLSTATE ||
      error.code === RELATED_NOTE_TARGET_DUPLICATED_SQLSTATE ||
      error.code === RELATED_NOTE_REASON_TOO_LONG_SQLSTATE ||
      error.code === RELATED_NOTE_TARGET_TOO_MANY_SQLSTATE
    ) {
      return {
        error: "관련 노트 추가 정보가 올바르지 않습니다.",
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsed.data.noteId),
  );

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
    if (error.code === RELATED_NOTE_AUTHENTICATION_REQUIRED_SQLSTATE) {
      return {
        error: "로그인이 필요합니다.",
      };
    }

    if (error.code === RELATED_NOTE_NOT_FOUND_SQLSTATE) {
      return {
        error: "수정할 관련 노트를 찾을 수 없습니다.",
      };
    }

    if (error.code === RELATED_NOTE_REASON_TOO_LONG_SQLSTATE) {
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

export type DeleteRelatedNoteActionResult =
  | {
      success: true;
      error?: never;
    }
  | {
      success?: false;
      error: string;
    };

/**
 * 현재 Note의 Related Note 관계를 제거합니다.
 *
 * 이 Action은 Client 입력 검증과 RPC 호출만 담당하며,
 * 실제 삭제 방식은 `delete_note_related` RPC에서 관계 origin에 따라 결정합니다.
 *
 * - manual 관계: row 삭제
 * - AI 관계: dismissed 상태로 전환
 *
 * 인증 사용자와 Note 소유권 역시 RPC에서 최종 검증합니다.
 *
 * @param input 삭제할 Related Note 관계 정보
 * @returns 삭제 성공 여부
 */
export async function deleteRelatedNoteAction(
  input: DeleteRelatedNoteInput,
): Promise<DeleteRelatedNoteActionResult> {
  const parsed = deleteRelatedNoteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: "관련 노트 삭제 정보가 올바르지 않습니다.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsed.data.noteId),
  );

  const { error } = await supabase.rpc("delete_note_related", {
    p_note_id: parsed.data.noteId,
    p_related_note_id: parsed.data.relatedNoteId,
  });

  if (error) {
    if (error.code === RELATED_NOTE_AUTHENTICATION_REQUIRED_SQLSTATE) {
      return {
        error: "로그인이 필요합니다.",
      };
    }

    if (error.code === RELATED_NOTE_NOT_FOUND_SQLSTATE) {
      return {
        error: "삭제할 관련 노트를 찾을 수 없습니다.",
      };
    }

    return {
      error: "관련 노트 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  return {
    success: true,
  };
}

type RequestRelatedNoteRecommendationExecution = {
  /** Claim RPC가 판정한 이번 추천 요청의 실행 상태입니다. */
  status: RelatedNoteRecommendationExecutionClaimStatus;

  /**
   * 이번 요청과 연결된 Claim ID입니다.
   *
   * 새 실행이 claimed된 경우에는 새 Claim ID이며,
   * duplicate가 기존 Claim을 가리키는 경우에도 해당 ID가 반환될 수 있습니다.
   */
  claimId: string | null;
};

export type RequestRelatedNoteRecommendationActionResult =
  | {
      success: true;
      execution: RequestRelatedNoteRecommendationExecution;
      error?: never;
    }
  | {
      success?: false;
      execution?: never;
      error: string;
    };

/**
 * 현재 Note의 AI Related Notes 추천 생성을 요청합니다.
 *
 * Client 입력과 현재 사용자의 Note 소유권을 확인한 뒤,
 * 현재 Note snapshot에 대한 execution claim을 먼저 판정합니다.
 *
 * 새 Claim이 생성된 경우에만 실제 AI 추천 실행을 `after()`에 예약하며,
 * duplicate/stale/daily limit 상태는 새로운 Provider 실행 없이
 * 즉시 Client에 반환합니다.
 *
 * Client는 claimed 결과의 claimId를 기준으로 실행 상태를 추적하므로,
 * background 실행이 빠르게 완료되어 running 상태를 직접 관찰하지 못해도
 * 해당 Claim의 terminal 상태를 확인해 polling을 종료할 수 있습니다.
 *
 * @param input AI Related Notes 추천 생성 요청
 * @returns 추천 실행 Claim 판정 결과
 */
export async function requestRelatedNoteRecommendationAction(
  input: RequestRelatedNoteRecommendationInput,
): Promise<RequestRelatedNoteRecommendationActionResult> {
  const parsed = requestRelatedNoteRecommendationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: "관련 노트 추천 요청 정보가 올바르지 않습니다.",
    };
  }

  const { noteId } = parsed.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  await requireCurrentLegalAcceptance(user.id, getNoteDetailRoute(noteId));

  const { data: note, error } = await supabase
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      error: "관련 노트 추천 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (!note) {
    return {
      error: "추천할 노트를 찾을 수 없습니다.",
    };
  }

  try {
    const execution = await scheduleRelatedNoteRecommendation({
      noteId: note.id,
      ownerUserId: user.id,
    });

    return {
      success: true,
      execution: {
        claimId: execution.claimId,
        status: execution.status,
      },
    };
  } catch {
    return {
      error: "관련 노트 추천 요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}
