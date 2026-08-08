"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  getNoteDetailRoute,
  getNoteReviewRoute,
  ROUTES,
} from "@/lib/constants/routes";
import { getGemini } from "@/lib/gemini/client";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

import { buildGradingPrompt } from "./lib/gradingPrompt";
import {
  getGradingByReviewLog,
  getNoteContentForComparison,
  getPendingReviewLog,
  getReviewableNote,
} from "./queries";
import {
  completeReviewSchema,
  gradeAnswerSchema,
  type GradingResponse,
  gradingResponseSchema,
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
      userAnswer: string;
      reviewLogId: string;
      error?: never;
    }
  | {
      success?: false;
      originalContent?: never;
      userAnswer?: never;
      error: SubmitAnswerFieldErrors | string;
    }
  | null;

export type CompleteReviewActionState = {
  error: string;
} | null;

export type GradeAnswerActionState =
  | { success: true; grading: GradingResponse; error?: never }
  | { success?: false; grading?: never; error: string }
  | null;

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

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  let note, pendingReviewLog;
  try {
    [note, pendingReviewLog] = await Promise.all([
      getNoteContentForComparison(parsed.data.noteId, user.id),
      getPendingReviewLog(parsed.data.noteId, user.id),
    ]);
  } catch {
    return {
      error: "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (!note) {
    return { error: "비교할 노트를 찾을 수 없습니다." };
  }

  if (!pendingReviewLog) {
    return { error: "진행 중인 복습을 찾을 수 없습니다." };
  }

  return {
    success: true,
    originalContent: note.content,
    userAnswer: parsed.data.answer,
    reviewLogId: pendingReviewLog.id,
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

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  let reviewableNote, pendingReviewLog;
  try {
    [reviewableNote, pendingReviewLog] = await Promise.all([
      getReviewableNote(parsed.data.noteId, user.id),
      getPendingReviewLog(parsed.data.noteId, user.id),
    ]);
  } catch {
    return {
      error: "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (!reviewableNote) {
    return { error: "노트를 찾을 수 없거나 접근 권한이 없습니다." };
  }

  if (!pendingReviewLog) {
    return { error: "이미 완료되었거나 진행 중인 복습이 없습니다." };
  }

  if (pendingReviewLog.id !== parsed.data.reviewLogId) {
    return {
      error: "답안을 제출한 뒤 원본을 확인하고 복습을 완료해주세요.",
    };
  }

  const { data: completedNoteId, error: completeReviewError } =
    await supabase.rpc("complete_review_and_schedule_next", {
      p_note_id: parsed.data.noteId,
      p_review_log_id: parsed.data.reviewLogId,
    });

  if (completeReviewError?.code === "WP001") {
    return {
      error:
        "오늘은 이미 이 노트의 복습을 완료했어요. 내일 자정(KST) 이후 다시 시도해주세요.",
    };
  }

  if (completeReviewError || !completedNoteId) {
    return {
      error: "복습 완료 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath(getNoteDetailRoute(parsed.data.noteId));
  revalidatePath(getNoteReviewRoute(parsed.data.noteId));
  redirect(getNoteDetailRoute(parsed.data.noteId));
}

export async function gradeAnswerAction(
  _prevState: GradeAnswerActionState,
  formData: FormData,
): Promise<GradeAnswerActionState> {
  const parsed = gradeAnswerSchema.safeParse({
    noteId: formData.get("noteId"),
    reviewLogId: formData.get("reviewLogId"),
    answer: formData.get("answer"),
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

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  let reviewableNote, note, pendingReviewLog;
  try {
    [reviewableNote, note, pendingReviewLog] = await Promise.all([
      getReviewableNote(parsed.data.noteId, user.id),
      getNoteContentForComparison(parsed.data.noteId, user.id),
      getPendingReviewLog(parsed.data.noteId, user.id),
    ]);
  } catch {
    return {
      error: "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  if (!reviewableNote || !note) {
    return { error: "노트를 찾을 수 없거나 접근 권한이 없습니다." };
  }

  if (!pendingReviewLog || pendingReviewLog.id !== parsed.data.reviewLogId) {
    return { error: "진행 중인 복습을 찾을 수 없습니다." };
  }

  // 복습 1회당 채점 1회 — 이미 채점했다면 저장된 결과를 재사용 (비용 통제 + 점수 일관성)
  try {
    const existing = await getGradingByReviewLog(
      parsed.data.reviewLogId,
      user.id,
    );
    if (existing) {
      return {
        success: true,
        grading: { score: existing.score, ...existing.feedback },
      };
    }
  } catch {
    return {
      error: "데이터를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  const prompt = buildGradingPrompt(
    reviewableNote.title,
    note.content,
    parsed.data.answer,
  );

  let responseText: string;
  try {
    const response = await getGemini().models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    responseText = response.text ?? "";
  } catch (e) {
    console.error("[gradeAnswerAction] Gemini API 호출 실패:", e);
    return { error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  let grading;
  try {
    const json: unknown = JSON.parse(responseText);
    grading = gradingResponseSchema.safeParse(json);
    if (!grading.success) {
      console.error("[gradeAnswerAction] Zod 파싱 실패:", grading.error.issues);
      console.error("[gradeAnswerAction] 원본 응답:", responseText);
    }
  } catch (e) {
    console.error("[gradeAnswerAction] JSON 파싱 실패:", e);
    console.error("[gradeAnswerAction] 원본 응답:", responseText);
    return { error: "채점 결과를 처리할 수 없습니다. 다시 시도해주세요." };
  }

  if (!grading.success) {
    return { error: "채점 결과를 처리할 수 없습니다. 다시 시도해주세요." };
  }

  const { score, summary, missedConcepts, incorrectPoints } = grading.data;
  const feedback: Json = { summary, missedConcepts, incorrectPoints };

  const { error: insertError } = await supabase.from("review_gradings").insert({
    review_log_id: parsed.data.reviewLogId,
    note_id: parsed.data.noteId,
    user_id: user.id,
    round: pendingReviewLog.round,
    user_answer: parsed.data.answer,
    score,
    feedback,
  });

  if (insertError) {
    // 유니크 제약(review_log_id) 충돌 = 동시 요청으로 이미 저장됨 → 기존 결과 반환
    if (insertError.code === "23505") {
      try {
        const existing = await getGradingByReviewLog(
          parsed.data.reviewLogId,
          user.id,
        );
        if (existing) {
          return {
            success: true,
            grading: { score: existing.score, ...existing.feedback },
          };
        }
      } catch {
        // 아래 공통 처리로 진행
      }
    }
    // 저장 실패해도 채점 결과 자체는 보여준다 (기록만 남지 않음)
    console.error("[gradeAnswerAction] 채점 결과 저장 실패:", insertError);
  }

  revalidatePath(getNoteDetailRoute(parsed.data.noteId));

  return { success: true, grading: grading.data };
}
