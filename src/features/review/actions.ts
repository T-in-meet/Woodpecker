"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { NoteLanguage } from "@/lib/constants/noteLanguages";
import { getNoteDetailRoute, getNoteReviewRoute } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import {
  getNoteContentForComparison,
  getPendingReviewLog,
  getReviewableNote,
} from "./queries";
import {
  completeReviewSchema,
  type SubmitAnswerInput,
  submitAnswerSchema,
} from "./schema";

type SubmitAnswerFieldErrors = Partial<
  Record<keyof SubmitAnswerInput, string[]>
>;

export type SubmitAnswerActionState =
  | {
      success: true;
      originalContent: string;
      language: NoteLanguage | null;
      userAnswer: string;
      error?: never;
    }
  | {
      success?: false;
      originalContent?: never;
      language?: never;
      userAnswer?: never;
      error: SubmitAnswerFieldErrors | string;
    }
  | null;

export type CompleteReviewActionState = {
  error: string;
} | null;

export async function submitAnswerAction(
  _prevState: SubmitAnswerActionState,
  formData: FormData,
): Promise<SubmitAnswerActionState> {
  const parsed = submitAnswerSchema.safeParse({
    noteId: formData.get("noteId"),
    answer: formData.get("answer"),
  });

  if (!parsed.success) {
    const { fieldErrors } = parsed.error.flatten();

    if (fieldErrors.noteId) {
      return { error: "요청이 올바르지 않습니다." };
    }

    return { error: fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const note = await getNoteContentForComparison(parsed.data.noteId, user.id);

  if (!note) {
    return { error: "비교할 노트를 찾을 수 없습니다." };
  }

  return {
    success: true,
    originalContent: note.content,
    language: note.language,
    userAnswer: parsed.data.answer,
  };
}

export async function completeReviewAction(
  _prevState: CompleteReviewActionState,
  formData: FormData,
): Promise<CompleteReviewActionState> {
  const parsed = completeReviewSchema.safeParse({
    noteId: formData.get("noteId"),
    reviewLogId: formData.get("reviewLogId"),
  });

  if (!parsed.success) {
    return { error: "요청이 올바르지 않습니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const [reviewableNote, pendingReviewLog] = await Promise.all([
    getReviewableNote(parsed.data.noteId, user.id),
    getPendingReviewLog(parsed.data.noteId, user.id),
  ]);

  if (
    !reviewableNote ||
    !pendingReviewLog ||
    pendingReviewLog.id !== parsed.data.reviewLogId
  ) {
    return { error: "진행 중인 복습을 찾을 수 없습니다." };
  }

  const { data: completedNoteId, error: completeReviewError } =
    await supabase.rpc("complete_review_and_schedule_next", {
      p_note_id: parsed.data.noteId,
      p_review_log_id: parsed.data.reviewLogId,
    });

  if (completeReviewError || !completedNoteId) {
    return {
      error: "복습 완료 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath(getNoteDetailRoute(parsed.data.noteId));
  revalidatePath(getNoteReviewRoute(parsed.data.noteId));
  redirect(getNoteDetailRoute(parsed.data.noteId));
}
