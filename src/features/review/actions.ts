"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  completeAiRunFailed,
  completeAiRunSucceeded,
  createAiRun,
} from "@/features/ai/runs/persistence";
import { AI_RUN_FEATURE_TYPE } from "@/features/ai/runs/types";
import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import { isReviewCompleted } from "@/features/notes/utils/noteStatus";
import { createReviewGradingSnapshotAccumulator } from "@/features/review/ai-runs/snapshot-accumulator";
import { claimResultSchema } from "@/lib/ai/claimResult";
import { generateJson } from "@/lib/ai/client";
import { toAiFailureReason } from "@/lib/ai/failureReason";
import { toCloudflareResponseSchema } from "@/lib/ai/responseSchema";
import {
  getNoteDetailRoute,
  getNoteReviewRoute,
  ROUTES,
} from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

import {
  GRADING_AI_FAILURE_MESSAGES,
  GRADING_ERROR_MESSAGES,
} from "./constants";
import { hashNoteContent } from "./lib/contentHash";
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
  GRADING_VALIDATION_JSON_SCHEMA,
  gradingGenerationSchema,
  type GradingResponse,
  gradingResponseSchema,
  normalizeGradingResponse,
  type SubmitAnswerInput,
  submitAnswerSchema,
} from "./schema";

type SubmitAnswerFieldErrors = Partial<
  Record<keyof SubmitAnswerInput, string[]>
>;

const REVIEW_COMPLETED_ERROR =
  "복습을 완료한 노트입니다. 노트 상세에서 복습을 다시 시작해주세요.";

export type SubmitAnswerActionState =
  | {
      success: true;
      originalContent: string;
      /** 화면에 보여준 원본의 본문 해시. 채점 요청에 실어 보내 기준이 어긋나는 걸 막는다. */
      originalContentHash: string;
      userAnswer: string;
      reviewLogId: string;
      error?: never;
    }
  | {
      success?: false;
      originalContent?: never;
      originalContentHash?: never;
      userAnswer?: never;
      error: SubmitAnswerFieldErrors | string;
    }
  | null;

export type CompleteReviewActionState = {
  error: string;
} | null;

export type GradeAnswerActionState =
  | {
      success: true;
      grading: GradingResponse;
      /**
       * 돌려준 결과가 지금 화면의 답안이 아니라 같은 회차에 먼저 제출한
       * 다른 답안을 채점한 것일 때 true. 화면에서 기준이 다르다고 알린다.
       */
      gradedOtherAnswer: boolean;
      /**
       * 이 결과의 기준이 된 답안. `gradedOtherAnswer`일 때 화면 답안과 다르므로,
       * 어떤 문장에 대한 피드백인지 사용자가 볼 수 있게 함께 돌려준다.
       */
      gradedAnswer: string;
      /**
       * 돌려준 결과의 기준 원본이 지금 화면의 원본과 다를 때 true.
       * 저장된 채점을 재사용하는 경로에서만 참이 될 수 있다. 페이지 복원 경로의
       * `basisContentChanged`와 같은 판단이며, 그쪽은 서버 컴포넌트가 계산한다.
       */
      basisContentChanged: boolean;
      error?: never;
    }
  | {
      success?: false;
      grading?: never;
      gradedOtherAnswer?: never;
      gradedAnswer?: never;
      basisContentChanged?: never;
      error: string;
    }
  | null;

/**
 * 채점 한 건에 허용하는 전체 시간. AI 호출 시점이 아니라 액션 진입 시각부터 잰다.
 *
 * 호출 직전에 타이머를 걸면 앞의 인증·조회·선점이 느릴 때 abort보다 플랫폼 제한이
 * 먼저 걸린다. 그러면 선점만 잡힌 채 함수가 죽어서, 사용자는 정상 오류도 못 받고
 * 선점이 만료될 때까지 재시도조차 막힌다.
 *
 * 복습 페이지의 maxDuration(90초)보다 짧게 두고, 선점 만료(120초)는 넘기지 않는다.
 * 이 값이 선점 만료를 넘기면 다른 요청이 선점을 이어받아 같은 채점에 AI를 두 번 부른다.
 * 순서: 이 값 < maxDuration < claim_review_grading의 stale window.
 *
 * 값 근거: reasoning_effort=low 적용 후 약 100,000자 입력도 8.9초에 완주했다.
 * 네트워크·인증·DB 지연과 실행 편차를 포함하도록 60초를 둔다.
 *
 * abort는 이쪽 요청만 끊는다. Cloudflare가 서버 쪽 추론과 Neurons 소비를 즉시 멈춘다는
 * 보장은 문서에 없다(공식 문서는 오류 `3008`과 실사용량 기준만 설명한다). 따라서 이
 * 타임아웃의 목적은 비용 절감이 아니라, 원인을 남기고 선점 만료 전에 끝내는 것이다.
 */
const GRADING_DEADLINE_MS = 60_000;

/**
 * 선점 시점에 남은 시간이 이보다 적으면 AI를 부르지 않고 실패시킨다.
 *
 * 어차피 완주하지 못할 호출로 선점을 잡으면 그 회차의 채점이 stale window(120초)가
 * 지날 때까지 통째로 막힌다. 과금만 발생하고 결과는 버려지는 호출이기도 하다.
 *
 * low effort 실측 최댓값보다 작은 15초 미만이 남았으면 완주 가능성이 낮다고 본다.
 *
 * claim RPC(claim_review_grading·quiz의 claim_quiz_generation_v2와 같은 사용자 단위
 * advisory lock 사용) 왕복 시간은 개발 DB에서 동시 요청으로 실측했다(2026-08-16).
 * 90~300ms였고, 동시 요청 간 뚜렷한 직렬화 흔적은 없었다. 이 값의 1~2%도 안 되는
 * 수준이라 재조정 없이 종결했다. 트래픽이 늘어 이 가정이 깨지면 재측정 스크립트를
 * 새로 작성해 다시 잰다.
 */
const MIN_AI_BUDGET_MS = 15_000;

/**
 * 채점 응답 구조를 디코딩 단계에서 강제한다. 검증은 그대로 Zod가 맡고,
 * 이건 형식 이탈 자체를 줄이는 첫 번째 방어선이다.
 * 파싱에 실패하면 사용자는 에러를 받고 선점이 풀릴 때까지 기다려야 하므로 실패를 줄이는 값이 크다.
 *
 * 수신 스키마가 아니라 `gradingGenerationSchema`를 넘긴다. 항목 개수 상한(`maxItems`)은
 * 생성 단계에서 강제할 값이지, 이미 나간 호출의 결과를 버릴 이유는 아니기 때문이다.
 *
 * 퀴즈는 유형별로 스키마가 달라 호출마다 변환하지만 채점은 하나로 고정이라 한 번만 만든다.
 */
const GRADING_RESPONSE_JSON_SCHEMA = toCloudflareResponseSchema(
  gradingGenerationSchema,
);

/** finalizer가 현재 실행에 귀속된 저장 결과 ID와 상태를 반환하는 계약입니다. */
const finalizeReviewGradingResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), gradingId: z.string().uuid() }),
  z.object({
    status: z.enum(["already_graded", "stale_claim", "not_found"]),
    gradingId: z.null(),
  }),
]);

/**
 * 선점이 거절된 이유를 그대로 사용자 문구로 옮기는 상태들.
 * 실제 한도 값은 claim_review_grading 함수 안에 있다(클라이언트가 넘길 수 없어야 하므로).
 * 여기 없는 실패 상태(not_found 등)는 아래에서 공통 문구로 처리한다.
 */
const CLAIM_ERROR_MESSAGES: Record<string, string | undefined> = {
  in_flight: GRADING_ERROR_MESSAGES.inFlight,
  daily_exceeded: GRADING_ERROR_MESSAGES.dailyExceeded,
};

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

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteReviewRoute(parsed.data.noteId),
  );

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

  if (isReviewCompleted(note)) {
    return { error: REVIEW_COMPLETED_ERROR };
  }

  if (!pendingReviewLog) {
    return { error: "진행 중인 복습을 찾을 수 없습니다." };
  }

  return {
    success: true,
    originalContent: note.content,
    originalContentHash: hashNoteContent(note.content),
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

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteReviewRoute(parsed.data.noteId),
  );

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

  if (isReviewCompleted(reviewableNote)) {
    return { error: REVIEW_COMPLETED_ERROR };
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

  if (completeReviewError?.message.includes("review already completed")) {
    return { error: REVIEW_COMPLETED_ERROR };
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

/**
 * 저장된 채점의 기준 원본이 지금 화면의 원본과 다른지.
 * 해시 도입 이전 행은 NULL이라 판단할 근거가 없으므로 알리지 않는다.
 */
function isBasisContentChanged(
  gradedContentHash: string | null,
  currentContentHash: string,
): boolean {
  return gradedContentHash !== null && gradedContentHash !== currentContentHash;
}

/**
 * 확정된 채점 결과를 읽어 액션 응답으로 변환한다.
 * 저장된 결과가 없으면(아직 채점 전이면) null을 돌려준다 — 호출부가 이어서
 * 새로 채점하는 경로로 진행할지, 아니면 못 찾은 것 자체를 오류로 볼지 판단한다.
 */
async function readStoredGrading(
  reviewLogId: string,
  userId: string,
  userAnswer: string,
  currentContentHash: string,
): Promise<GradeAnswerActionState | null> {
  try {
    const existing = await getGradingByReviewLog(reviewLogId, userId);
    if (!existing) {
      return null;
    }

    return {
      success: true,
      grading: { score: existing.score, ...existing.feedback },
      gradedOtherAnswer: existing.user_answer !== userAnswer,
      gradedAnswer: existing.user_answer,
      basisContentChanged: isBasisContentChanged(
        existing.graded_content_hash,
        currentContentHash,
      ),
    };
  } catch {
    return {
      error: "채점 결과를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }
}

/**
 * claim/finalize가 "already_graded"를 돌려줬을 때 저장된 채점을 찾아 반환한다.
 * 두 RPC 모두 자신이 최신 선점이 아니라고 판단했을 때 이 상태를 쓰므로, 저장된
 * 행이 반드시 있어야 정상이다 — 없으면 정상 경로에서는 나오지 않는 상태다.
 */
async function resolveAlreadyGraded(
  reviewLogId: string,
  userId: string,
  userAnswer: string,
  contentHash: string,
): Promise<GradeAnswerActionState> {
  const alreadyGraded = await readStoredGrading(
    reviewLogId,
    userId,
    userAnswer,
    contentHash,
  );

  if (alreadyGraded) {
    return alreadyGraded;
  }

  console.error("[gradeAnswerAction] already_graded인데 채점 결과를 찾지 못함");
  return {
    error: "채점 결과를 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
  };
}

export async function gradeAnswerAction(
  _prevState: GradeAnswerActionState,
  formData: FormData,
): Promise<GradeAnswerActionState> {
  // 선점 전에 남은 예산을 계산하는 기준점. 플랫폼의 maxDuration도 여기서부터 흐른다.
  const startedAt = Date.now();

  const parsed = gradeAnswerSchema.safeParse({
    noteId: formData.get("noteId"),
    reviewLogId: formData.get("reviewLogId"),
    originalContentHash: formData.get("originalContentHash"),
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

  await requireCurrentLegalAcceptance(
    user.id,
    getNoteReviewRoute(parsed.data.noteId),
  );

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
    return { error: "노트를 찾을 수 없거나 접근 권한이 없습니다." };
  }

  if (isReviewCompleted(note)) {
    return { error: REVIEW_COMPLETED_ERROR };
  }

  if (!pendingReviewLog || pendingReviewLog.id !== parsed.data.reviewLogId) {
    return { error: "진행 중인 복습을 찾을 수 없습니다." };
  }

  // 저장된 채점을 돌려줄 때도 "그 채점의 기준 원본이 지금 화면의 원본과 같은지"를
  // 판단해야 하므로, 아래 재사용 분기보다 앞에서 계산한다.
  const contentHash = hashNoteContent(note.content);

  // 복습 1회당 채점 1회 — 이미 채점했다면 저장된 결과를 재사용 (비용 통제 + 점수 일관성)
  const stored = await readStoredGrading(
    parsed.data.reviewLogId,
    user.id,
    parsed.data.answer,
    contentHash,
  );

  if (stored) {
    return stored;
  }

  // 화면이 보여준 원본과 지금 채점할 원본이 같은 본문인지 확인한다.
  // 비교 화면을 띄워둔 사이 다른 탭에서 노트를 고치면, 사용자는 구 본문을 보면서
  // AI는 신 본문으로 채점하게 된다.
  // 이미 확정된 채점을 읽는 경로는 새로 채점하지 않으므로 이 검사보다 앞에 둔다.
  if (contentHash !== parsed.data.originalContentHash) {
    return {
      error:
        "채점을 준비하는 사이 노트가 수정됐어요. 새로고침 후 다시 비교해주세요.",
    };
  }

  // 선점하기 전에 AI 호출을 완주시킬 시간이 남았는지 확인한다.
  // 여기서 잡은 선점은 이 요청이 끝나거나 stale window가 지나기 전까지
  // 같은 회차의 다른 채점 시도를 모두 막으므로, 못 쓸 선점은 아예 잡지 않는다.
  const aiBudgetMs = GRADING_DEADLINE_MS - (Date.now() - startedAt);

  if (aiBudgetMs < MIN_AI_BUDGET_MS) {
    console.error(
      `[gradeAnswerAction] 남은 시간이 부족해 채점을 시작하지 않음 (${aiBudgetMs}ms)`,
    );
    return {
      error: "서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
    };
  }

  // 두 채점 RPC는 service_role 전용이다. authenticated에 열어 두면 사용자가 PostgREST로
  // claim → finalize(100점)를 직접 호출해 AI 없이 점수를 확정할 수 있다.
  // 세션·이메일 인증·노트 소유권·pending 복습 로그 일치를 모두 확인한 뒤에만 여기에 도달한다.
  const admin = createAdminClient();

  // AI 호출 전에 채점 권한을 원자적으로 선점한다.
  // 앞의 조회만으로 분기하면 동시 요청이 모두 "미채점"을 보고 각자 AI를 호출한다
  // (유니크 제약은 저장 중복만 막을 뿐 이미 나간 API 비용은 되돌리지 못한다).
  // MIN_AI_BUDGET_MS는 이 RPC의 왕복 시간을 반영하지 않는다(주석 참고). 락 경합 등으로
  // 얼마나 걸리는지 실측 데이터를 쌓기 위해 매 호출마다 소요 시간을 남긴다.
  const claimStartedAt = Date.now();
  const { data: claimData, error: claimError } = await admin.rpc(
    "claim_review_grading",
    {
      p_user_id: user.id,
      p_review_log_id: parsed.data.reviewLogId,
      p_user_answer: parsed.data.answer,
      p_content_hash: contentHash,
    },
  );
  console.log(
    `[gradeAnswerAction] claim_review_grading RPC 소요 시간: ${Date.now() - claimStartedAt}ms`,
  );

  if (claimError) {
    console.error("[gradeAnswerAction] 채점 선점 실패:", claimError.message);
    return { error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  const claim = claimResultSchema.safeParse(claimData);

  if (!claim.success) {
    console.error("[gradeAnswerAction] 채점 선점 응답 형식이 올바르지 않음");
    return { error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  if (claim.data.status === "already_graded") {
    return resolveAlreadyGraded(
      parsed.data.reviewLogId,
      user.id,
      parsed.data.answer,
      contentHash,
    );
  }

  const claimErrorMessage = CLAIM_ERROR_MESSAGES[claim.data.status];

  if (claimErrorMessage) {
    return { error: claimErrorMessage };
  }

  if (claim.data.status !== "ok") {
    return { error: "진행 중인 복습을 찾을 수 없습니다." };
  }

  // 확정 단계에서 이 토큰으로 "내가 선점한 세대가 맞는지"를 확인한다.
  const claimToken = claim.data.claimToken;

  if (!claimToken) {
    console.error("[gradeAnswerAction] 선점 토큰이 비어 있음");
    return { error: "AI 채점에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  // 이 시점부터 실제 새 AI 채점이 시작된다. 앞선 모든 실행 제어 분기에는 Run이 없다.
  const aiStartedAt = new Date().toISOString();
  const snapshotAccumulator = createReviewGradingSnapshotAccumulator({
    note: { id: parsed.data.noteId, content: note.content },
    reviewLog: {
      id: pendingReviewLog.id,
      noteId: pendingReviewLog.note_id,
      round: pendingReviewLog.round,
      scheduledAt: pendingReviewLog.scheduled_at,
      completedAt: pendingReviewLog.completed_at,
    },
    answer: parsed.data.answer,
    originalContentHash: parsed.data.originalContentHash,
    currentContentHash: contentHash,
  });
  const aiRun = await createAiRun({
    buildSnapshot: snapshotAccumulator.buildSnapshot,
    featureType: AI_RUN_FEATURE_TYPE.REVIEW_GRADING,
    startedAt: aiStartedAt,
    userId: user.id,
  });

  // 제목은 채점 입력에 넣지 않는다. 해시가 지키는 범위가 본문뿐이라, 제목을 넣으면
  // 제목만 바뀐 노트가 해시 검사를 통과하면서 화면에 없던 제목으로 채점된다.
  const prompt = buildGradingPrompt(note.content, parsed.data.answer);
  snapshotAccumulator.prepareGrading({
    originalContent: note.content,
    userAnswer: parsed.data.answer,
    renderedPrompt: prompt,
    responseSchema: GRADING_RESPONSE_JSON_SCHEMA,
  });

  // 실제 AbortSignal과 generation Snapshot이 같은 남은 실행 예산을 공유한다.
  const timeoutMs = Math.max(0, GRADING_DEADLINE_MS - (Date.now() - startedAt));
  snapshotAccumulator.prepareGeneration({
    prompt,
    responseSchema: GRADING_RESPONSE_JSON_SCHEMA,
    timeoutMs,
  });

  let responseText: string;
  try {
    responseText = await generateJson({
      prompt,
      responseSchema: GRADING_RESPONSE_JSON_SCHEMA,
      // 선점 뒤 한 번 계산한 예산을 Signal과 Snapshot에서 함께 사용한다. 진입 시각
      // 기준이어야 README의 "채점 deadline < maxDuration" 순서가 유지된다.
      abortSignal: AbortSignal.timeout(timeoutMs),
      onObservation: snapshotAccumulator.observeGeneration,
    });
  } catch (e) {
    // Provider/extraction 실패까지 확보한 partial Snapshot으로 failed terminal 저장을 시도한다.
    await completeAiRunFailed({
      aiRun,
      buildSnapshot: snapshotAccumulator.buildSnapshot,
      completedAt: new Date().toISOString(),
    });
    // CloudflareAiError는 프롬프트·노트·답안을 담지 않으므로 그대로 남겨도 안전하다.
    console.error("[gradeAnswerAction] AI 호출 실패:", e);
    return { error: GRADING_AI_FAILURE_MESSAGES[toAiFailureReason(e)] };
  }

  snapshotAccumulator.startParseAndValidation({
    responseText,
    validationSchema: GRADING_VALIDATION_JSON_SCHEMA,
  });

  // 응답 원문에는 노트·답안 내용이 그대로 담기므로 로그에 남기지 않는다.
  let json: unknown;
  try {
    json = JSON.parse(responseText);
    snapshotAccumulator.completeJsonParse(json);
  } catch (error) {
    snapshotAccumulator.failJsonParse(error);
    await completeAiRunFailed({
      aiRun,
      buildSnapshot: snapshotAccumulator.buildSnapshot,
      completedAt: new Date().toISOString(),
    });
    // SyntaxError 메시지에는 파싱에 실패한 원문 조각이 섞여 나오므로 함께 남기지 않는다.
    console.error(
      `[gradeAnswerAction] JSON 파싱 실패 (응답 길이 ${responseText.length})`,
    );
    return { error: "채점 결과를 처리할 수 없습니다. 다시 시도해주세요." };
  }

  const grading = gradingResponseSchema.safeParse(json);

  if (!grading.success) {
    snapshotAccumulator.failValidation(grading.error.issues);
    await completeAiRunFailed({
      aiRun,
      buildSnapshot: snapshotAccumulator.buildSnapshot,
      completedAt: new Date().toISOString(),
    });
    console.error(
      `[gradeAnswerAction] Zod 파싱 실패 (응답 길이 ${responseText.length}):`,
      grading.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })),
    );
    return { error: "채점 결과를 처리할 수 없습니다. 다시 시도해주세요." };
  }

  snapshotAccumulator.completeValidation(grading.data);

  // 프롬프트와 생성 스키마가 약속한 개수를 넘겼다면 여기서 맞춘다.
  // 저장 전에 자르지 않으면 UI에도 DB에도 상한을 넘긴 값이 그대로 남는다.
  const normalized = normalizeGradingResponse(grading.data);
  snapshotAccumulator.completeNormalization(grading.data, normalized);
  snapshotAccumulator.completeFinalOutput(normalized);

  const { score, summary, missedConcepts, incorrectPoints } = normalized;
  const feedback: Json = { summary, missedConcepts, incorrectPoints };

  let finalizeResult: unknown = null;
  let finalizeError: { message: string } | null = null;
  try {
    const result = await admin.rpc("finalize_review_grading", {
      p_user_id: user.id,
      p_review_log_id: parsed.data.reviewLogId,
      p_claim_token: claimToken,
      p_score: score,
      p_feedback: feedback,
    });
    finalizeResult = result.data;
    finalizeError = result.error;
  } catch (error) {
    // AI 결과 확정 뒤의 DB 예외는 사용자 오류로 처리하되 Run 성공은 유지한다.
    finalizeError = {
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }

  const parsedFinalizeResult =
    finalizeReviewGradingResultSchema.safeParse(finalizeResult);
  const finalizerStatus = parsedFinalizeResult.success
    ? parsedFinalizeResult.data.status
    : null;
  const featureResultIds =
    finalizeError === null &&
    parsedFinalizeResult.success &&
    parsedFinalizeResult.data.status === "ok" &&
    parsedFinalizeResult.data.gradingId !== null
      ? [parsedFinalizeResult.data.gradingId]
      : [];

  // Final Output 이후 Review Grading 저장 결과와 무관하게 AI 성공으로 보고 succeeded terminal 저장을 시도한다.
  await completeAiRunSucceeded({
    aiRun,
    buildSnapshot: snapshotAccumulator.buildSnapshot,
    completedAt: new Date().toISOString(),
    featureResultIds,
  });

  if (finalizeError || finalizerStatus !== "ok") {
    // 선점이 만료된 사이 다른 요청이 먼저 저장한 경우 → 저장된 결과를 정본으로 삼는다
    if (finalizerStatus === "already_graded") {
      return resolveAlreadyGraded(
        parsed.data.reviewLogId,
        user.id,
        parsed.data.answer,
        contentHash,
      );
    }

    console.error(
      "[gradeAnswerAction] 채점 결과 저장 실패:",
      finalizeError?.message ?? finalizeResult,
    );

    // 저장에 실패한 결과를 성공으로 보여주면 새로고침 시 사라지고 기록에도 남지 않는다.
    if (finalizerStatus === "stale_claim") {
      return {
        error: "다른 채점 요청이 먼저 진행됐어요. 잠시 후 다시 시도해주세요.",
      };
    }

    return {
      error: "채점 결과를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath(getNoteDetailRoute(parsed.data.noteId));

  return {
    success: true,
    grading: normalized,
    gradedOtherAnswer: false,
    gradedAnswer: parsed.data.answer,
    // 방금 이 본문으로 채점했으므로 기준이 갈릴 여지가 없다.
    basisContentChanged: false,
  };
}
