"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { getNextReviewDate } from "@/lib/constants/reviewIntervals";
import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "../ai/rags/note/constants/runtime";
import { generateNoteEmbedding } from "../ai/rags/note/generate-embedding";
import { resolveAiRuntimeEmbeddingConfiguration } from "../ai/runtimes";
import { reportAiOperationalError } from "../ai/utils/report-ai-operational-error";
import { scheduleRelatedNoteRecommendation } from "../related-notes/execution/schedule-related-note-recommendation";
import { type NoteInput, noteSchema } from "./schema";

type NoteActionFieldErrors = Partial<Record<keyof NoteInput, string[]>>;

const noteIdSchema = z.string().uuid();

/**
 * 저장된 Note의 embedding 생성을 응답 이후 후처리로 예약합니다.
 *
 * Note 저장/수정 자체와 AI embedding 생성을 분리하여,
 * Runtime 설정 조회나 Provider 호출 시간이 사용자 저장 응답을 지연시키지 않도록 합니다.
 *
 * 후처리 시 DB에서 Note의 최신 snapshot을 다시 조회하며,
 * 조회 이후 Note가 다시 수정되더라도 generation 활성화 단계에서 updated_at을
 * 검증하므로 오래된 generation이 활성 상태가 되는 것을 방지합니다.
 *
 * embedding 후처리 실패는 이미 성공한 Note 저장/수정 결과에 영향을 주지 않습니다.
 */
function scheduleNoteEmbedding({
  noteId,
  ownerUserId,
}: {
  noteId: string;
  ownerUserId: string;
}) {
  after(async () => {
    const supabase = createAdminClient();

    /*
     * embedding에 사용할 title/content/updated_at을 하나의 DB snapshot에서
     * 가져와 서로 다른 Note version의 값이 섞이지 않도록 합니다.
     *
     * service role client를 사용하지만 ownerUserId까지 함께 조건에 포함하여
     * 인증된 사용자가 저장한 자신의 Note만 후처리 대상으로 조회합니다.
     */
    const { data: embeddingSource, error: embeddingSourceError } =
      await supabase
        .from("notes")
        .select("id, title, content, updated_at")
        .eq("id", noteId)
        .eq("user_id", ownerUserId)
        .maybeSingle();

    /*
     * DB 조회 자체가 실패한 경우에만 운영 오류로 기록합니다.
     *
     * embeddingSource가 없는 경우와 조회 오류를 구분하여,
     * 실제 DB 오류만 EMBEDDING_SOURCE_LOAD_FAILED로 보고합니다.
     */
    if (embeddingSourceError) {
      await reportAiOperationalError({
        error: embeddingSourceError,
        errorCode: AI_OPERATIONAL_ERROR_CODE.EMBEDDING_SOURCE_LOAD_FAILED,
        message: "AI embedding 생성을 위한 Note source 조회에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.GET_EMBEDDING_SOURCE,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
        context: {
          noteId,
        },
      });

      return;
    }

    /*
     * 조회는 정상적으로 완료됐지만 Note가 존재하지 않는 경우에는
     * 저장 이후 embedding 후처리가 실행되기 전에 사용자가 Note를 삭제한
     * 정상적인 흐름일 수 있으므로 운영 오류를 기록하지 않고 종료합니다.
     */
    if (!embeddingSource) {
      return;
    }

    try {
      /*
       * 공통 Note retrieval Runtime 설정을 사용합니다.
       *
       * Runtime 설정 조회와 Provider embedding 생성은 모두 후처리에서 실행되므로
       * Note 저장/수정 응답 시간을 지연시키지 않습니다.
       */
      const embeddingConfiguration =
        await resolveAiRuntimeEmbeddingConfiguration({
          featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
          roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
        });

      await generateNoteEmbedding({
        embeddingConfiguration,
        ownerUserId,
        noteId: embeddingSource.id,
        sourceUpdatedAt: embeddingSource.updated_at,
        title: embeddingSource.title,
        content: embeddingSource.content,
      });
    } catch {
      /*
       * Runtime Configuration, Provider 호출, embedding 저장,
       * generation 활성화 등의 실패는 각 AI Foundation 실행 계층에서
       * operational error로 기록합니다.
       *
       * Note 자체는 이미 정상 저장되었으므로 후처리 오류를 다시 throw하여
       * 저장/수정 결과에 영향을 주지 않습니다.
       */
    }
  });
}

export type CreateNoteActionState =
  | {
      success: true;
      newNoteId: string;
      error?: never;
    }
  | {
      success?: false;
      newNoteId?: never;
      error: NoteActionFieldErrors | string;
    }
  | null;

export async function createNoteAction(
  _prevState: CreateNoteActionState,
  formData: FormData,
): Promise<CreateNoteActionState> {
  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

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

  await requireCurrentLegalAcceptance(user.id, ROUTES.NOTES_NEW);

  const firstReviewDate = getNextReviewDate(0);

  if (!firstReviewDate) {
    return { error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  const { data: newNoteId, error } = await supabase.rpc(
    "create_note_with_initial_review_log",
    {
      p_title: parsed.data.title,
      p_content: parsed.data.content,
      p_scheduled_at: firstReviewDate.toISOString(),
    },
  );

  if (error || !newNoteId) {
    return { error: "노트 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  /*
   * Note 저장 성공 이후 embedding 생성을 후처리로 예약합니다.
   *
   * embedding Runtime 설정 조회 및 Provider 호출 완료를 기다리지 않으므로
   * AI 후처리가 Note 생성 응답 속도나 성공 여부에 영향을 주지 않습니다.
   */
  scheduleNoteEmbedding({
    noteId: newNoteId,
    ownerUserId: user.id,
  });

  /*
   * Related Notes AI 추천도 Note 생성 응답 이후 후처리로 예약합니다.
   *
   * Runtime 설정 조회, Query Expansion, RAG 검색, Answer Agent 실행 및
   * 추천 저장을 Action 응답 경로에서 분리하여,
   * AI 추천 처리 시간이 Note 생성 성공 응답을 지연시키지 않도록 합니다.
   */
  scheduleRelatedNoteRecommendation({
    noteId: newNoteId,
    ownerUserId: user.id,
  });

  return {
    success: true,
    newNoteId,
  };
}

export type UpdateNoteActionState =
  | {
      success: true;
      error?: never;
    }
  | {
      success?: false;
      error: NoteActionFieldErrors | string;
    }
  | null;

export async function updateNoteAction(
  noteId: string,
  _prevState: UpdateNoteActionState,
  formData: FormData,
): Promise<UpdateNoteActionState> {
  const parsedNoteId = noteIdSchema.safeParse(noteId);

  if (!parsedNoteId.success) {
    return { error: "수정할 노트를 찾을 수 없습니다." };
  }

  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

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

  /*
   * UPDATE가 실제로 저장한 Note의 ID를 반환받습니다.
   *
   * embedding 생성은 응답 이후 Note를 다시 조회하여 최신 snapshot을 사용하므로
   * 저장 요청에서 embedding용 title/content/updated_at을 기다릴 필요가 없습니다.
   */
  const { data: updatedNote, error } = await supabase
    .from("notes")
    .update({
      title: parsed.data.title,
      content: parsed.data.content,
    })
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .select("id, title, content")
    .maybeSingle();

  if (error) {
    return { error: "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (!updatedNote) {
    return { error: "수정할 노트를 찾을 수 없습니다." };
  }

  /*
   * Note 수정 성공 이후 embedding 재생성을 후처리로 예약합니다.
   *
   * Provider 호출이 느리거나 embedding 생성이 실패하더라도
   * 이미 완료된 Note 수정 결과에는 영향을 주지 않습니다.
   */
  scheduleNoteEmbedding({
    noteId: updatedNote.id,
    ownerUserId: user.id,
  });

  /*
   * 수정된 Note의 Related Notes AI 추천도 응답 이후 후처리로 예약합니다.
   *
   * 후처리에서는 DB에서 최신 Note snapshot을 다시 조회하고,
   * 추천 저장 시 updated_at을 검증하므로 연속 수정 중 생성된
   * stale 추천이 최신 추천을 덮어쓰지 않도록 합니다.
   */
  scheduleRelatedNoteRecommendation({
    noteId: updatedNote.id,
    ownerUserId: user.id,
  });

  return { success: true };
}

export async function deleteNoteAction(noteId: string) {
  const parsedNoteId = noteIdSchema.safeParse(noteId);

  if (!parsedNoteId.success) {
    return { error: "삭제할 노트를 찾을 수 없습니다." };
  }

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

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteDetailRoute(parsedNoteId.data),
  );

  const { data: deletedNote, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", parsedNoteId.data)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "노트 삭제에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (!deletedNote) {
    return { error: "삭제할 노트를 찾을 수 없습니다." };
  }

  redirect(ROUTES.NOTES);
}
