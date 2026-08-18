"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { getNextReviewDate } from "@/lib/constants/reviewIntervals";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { generateNoteEmbedding } from "../ai/rags/note/generate-embedding";
import { resolveAiRuntimeEmbeddingConfiguration } from "../ai/runtimes";
import { reportAiOperationalError } from "../ai/utils/report-ai-operational-error";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "../note-chats/constants/ai";
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

    if (embeddingSourceError || !embeddingSource) {
      const error =
        embeddingSourceError ??
        new Error("Failed to load Note source for embedding.");

      await reportAiOperationalError({
        error,
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

    try {
      /*
       * Note Chat의 검색 대상 embedding과 동일한 Runtime 설정을 사용합니다.
       *
       * Runtime 설정 조회와 Provider embedding 생성은 모두 후처리에서 실행되므로
       * Note 저장/수정 응답 시간을 지연시키지 않습니다.
       */
      const embeddingConfiguration =
        await resolveAiRuntimeEmbeddingConfiguration({
          featureKey: NOTE_CHAT_AI_FEATURE_KEY,
          roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
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
    .select("id")
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
