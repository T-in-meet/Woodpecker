"use server";

import { z } from "zod";

import { generateJson } from "@/lib/ai/client";
import { toAiFailureReason } from "@/lib/ai/failureReason";
import {
  buildQuizPrompt,
  getMaxQuestions,
  pickPerspective,
  type QuizType,
} from "@/lib/ai/prompts";
import { toCloudflareResponseSchema } from "@/lib/ai/responseSchema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

import { QUIZ_AI_FAILURE_MESSAGES, QUIZ_ERROR_MESSAGES } from "./constants";
import {
  type QuizQuestion,
  quizResponseSchemaFor,
  quizTypeSchema,
} from "./schema";

const noteIdSchema = z.string().uuid();

/**
 * 재생성은 온도를 더 올린다.
 * 이미 한 번 본 퀴즈와 달라지는 것이 정확도보다 중요하기 때문이다.
 */
const TEMPERATURE = {
  initial: 1.0,
  regenerate: 1.2,
} as const;

/**
 * 출제 이력을 몇 세트까지 남길지.
 * 더 늘리면 회피 대상이 쌓여 노트에 남은 재료가 금방 바닥난다.
 */
const MAX_HISTORY_SETS = 3;

/** 이력이 길어져도 프롬프트가 노트 내용을 밀어내지 않도록 두는 상한. */
const MAX_PREVIOUS_QUESTIONS = 45;

// recent_questions는 jsonb라 DB가 형식을 보장하지 않는다.
const questionHistorySchema = z.array(z.array(z.string()));

// claim_quiz_generation_v2는 상태와 선점 토큰을 jsonb로 돌려준다.
const claimResultSchema = z.object({
  status: z.string(),
  claimToken: z.string().uuid().optional(),
});

// claim_quiz_generation_v2의 반환값을 사용자 메시지로 옮긴다.
const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  not_found: QUIZ_ERROR_MESSAGES.noteNotFound,
  in_flight: QUIZ_ERROR_MESSAGES.inFlight,
  too_many_requests: QUIZ_ERROR_MESSAGES.tooManyRequests,
  daily_exceeded: QUIZ_ERROR_MESSAGES.dailyExceeded,
};

type GenerateQuizResult =
  | { data: { questions: QuizQuestion[]; isNew: boolean } }
  | { error: string };

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 캐시 키에는 프롬프트에 실제로 들어가는 입력을 모두 반영한다.
 * 제목도 프롬프트에 포함되므로 제목만 바뀌어도 새로 생성해야 한다.
 * 퀴즈 유형은 quizzes.quiz_type 컬럼으로 분리돼 있어 해시에 넣지 않는다.
 */
async function buildCacheKey(title: string, content: string): Promise<string> {
  return hashContent(`${title}\n${content}`);
}

type ValidatedInput = {
  noteId: string;
  quizType: QuizType;
};

function parseInput(
  noteId: string,
  quizType: string,
): { data: ValidatedInput } | { error: string } {
  const parsedId = noteIdSchema.safeParse(noteId);
  if (!parsedId.success) {
    return { error: QUIZ_ERROR_MESSAGES.invalidNote };
  }

  const parsedType = quizTypeSchema.safeParse(quizType);
  if (!parsedType.success) {
    return { error: QUIZ_ERROR_MESSAGES.invalidQuizType };
  }

  return { data: { noteId: parsedId.data, quizType: parsedType.data } };
}

type RequestQuestionsResult = { data: QuizQuestion[] } | { error: string };

type RequestQuestionsParams = {
  title: string;
  content: string;
  quizType: QuizType;
  previousQuestions: string[];
  temperature: number;
  /**
   * 호출을 끊을 신호.
   *
   * 아직 호출부에서 넘기지 않는다. 퀴즈 deadline은 노트 상세 페이지의 `maxDuration`,
   * `claim_quiz_generation`의 in-flight 창과 함께 "deadline < maxDuration < in-flight 창"
   * 순서를 이뤄야 하는데, 그 값들이 긴 노트·최대 문항 실측 뒤에야 정해지기 때문이다.
   * 여기까지 배선해 두고 값이 나오면 채운다.
   */
  abortSignal?: AbortSignal;
};

async function requestQuestions(
  params: RequestQuestionsParams,
): Promise<RequestQuestionsResult> {
  const { title, content, quizType, previousQuestions, temperature } = params;
  const prompt = buildQuizPrompt(
    title,
    content,
    getMaxQuestions(content.length),
    quizType,
    {
      perspective: pickPerspective(),
      previousQuestions,
    },
  );

  // 프롬프트만으로 형식을 지시하면 유형·필드가 어긋난 응답이 나온다. 디코딩 단계에서 막는다.
  const responseSchema = quizResponseSchemaFor(quizType);

  let responseText: string;
  try {
    // 키가 없으면 이 줄에서 에러가 나고 아래 catch가 받아 준다.
    responseText = await generateJson({
      prompt,
      responseSchema: toCloudflareResponseSchema(responseSchema),
      temperature,
      abortSignal: params.abortSignal,
    });
  } catch (e) {
    // CloudflareAiError는 프롬프트·노트 내용을 담지 않으므로 그대로 남겨도 안전하다.
    console.error("[generateQuiz] AI 호출 실패:", e);
    return { error: QUIZ_AI_FAILURE_MESSAGES[toAiFailureReason(e)] };
  }

  // 응답 원문에는 노트 내용이 그대로 담기므로 로그에 남기지 않는다.
  let json: unknown;
  try {
    json = JSON.parse(responseText);
  } catch {
    // SyntaxError 메시지에는 파싱에 실패한 원문 조각이 섞여 나오므로 함께 남기지 않는다.
    console.error(
      `[generateQuiz] JSON 파싱 실패 (응답 길이 ${responseText.length})`,
    );
    return { error: QUIZ_ERROR_MESSAGES.parseFailed };
  }

  // 요청한 유형으로 검증한다. 유형이 섞인 응답은 프롬프트를 무시했다는 뜻이라 세트째 버린다.
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    console.error(
      `[generateQuiz] Zod 파싱 실패 (응답 길이 ${responseText.length}):`,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })),
    );
    return { error: QUIZ_ERROR_MESSAGES.parseFailed };
  }

  return { data: parsed.data.questions };
}

type QuizCache = {
  /** 형식이 깨졌거나 유형이 맞지 않는 캐시는 null이다. 이력은 그대로 쓸 수 있으므로 캐시 전체를 버리지는 않는다. */
  questions: QuizQuestion[] | null;
  /** 최신 세트가 앞에 오는 출제 이력. */
  history: string[][];
};

/**
 * 캐시된 퀴즈와 출제 이력을 읽는다. 노트가 바뀌었으면(해시 불일치) null이다.
 * 재생성에서도 호출한다. 최근에 낸 문제를 알아야 같은 지점을 다시 묻지 않게 지시할 수 있다.
 */
async function loadCache(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { noteId: string; quizType: QuizType; cacheKey: string },
): Promise<QuizCache | null> {
  const { data: cached } = await supabase
    .from("quizzes")
    .select("questions, recent_questions, note_content_hash")
    .eq("note_id", params.noteId)
    .eq("quiz_type", params.quizType)
    .maybeSingle();

  if (!cached || cached.note_content_hash !== params.cacheKey) {
    return null;
  }

  // 검증이 없던 시절에 저장된 행을 대비해 읽을 때도 유형을 확인한다. 어긋나면 새로 생성한다.
  const questions = quizResponseSchemaFor(params.quizType).safeParse({
    questions: cached.questions,
  });
  const history = questionHistorySchema.safeParse(cached.recent_questions);

  return {
    questions: questions.success ? questions.data.questions : null,
    history: history.success ? history.data : [],
  };
}

/**
 * 이력을 프롬프트에 넣을 문장 목록으로 편다.
 * 최신 세트부터 채우므로, 상한에 걸려 잘리는 것은 항상 오래된 회차다.
 */
function flattenHistory(history: string[][]): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];

  for (const set of history) {
    for (const question of set) {
      if (seen.has(question)) {
        continue;
      }

      seen.add(question);
      questions.push(question);

      if (questions.length >= MAX_PREVIOUS_QUESTIONS) {
        return questions;
      }
    }
  }

  return questions;
}

/**
 * 생성된 퀴즈를 캐시에 저장한다.
 * 저장에 실패해도 퀴즈 자체는 사용자에게 돌려주므로 에러는 로그만 남긴다.
 */
async function saveQuiz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    noteId: string;
    userId: string;
    quizType: QuizType;
    questions: QuizQuestion[];
    history: string[][];
    cacheKey: string;
  },
): Promise<void> {
  // 이번 세트를 맨 앞에 쌓고 오래된 세트부터 버린다.
  const history = [
    params.questions.map((question) => question.question),
    ...params.history,
  ].slice(0, MAX_HISTORY_SETS);

  const { error } = await supabase.from("quizzes").upsert(
    {
      note_id: params.noteId,
      user_id: params.userId,
      quiz_type: params.quizType,
      questions: JSON.parse(JSON.stringify(params.questions)) as Json,
      recent_questions: history,
      note_content_hash: params.cacheKey,
    },
    { onConflict: "note_id,quiz_type" },
  );

  if (error) {
    console.error("[generateQuiz] 퀴즈 캐시 저장 실패:", error.message);
  }
}

/**
 * AI 호출 1회를 선점한다 (claim_quiz_generation_v2).
 * 한도 값은 DB 함수가 들고 있다. 여기서 인자로 넘기면 PostgREST로 우회할 수 있다.
 *
 * v2는 service_role 전용이라 admin 클라이언트로 부른다. authenticated에 열린
 * v1(claim_quiz_generation)과 달리, 클라이언트가 PostgREST로 직접 호출해 토큰을
 * 읽을 수 없어야 finalize의 선점 확인이 보안 경계로 성립한다.
 */
async function claimGeneration(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  noteId: string,
  quizType: QuizType,
): Promise<{ ok: true; claimToken: string } | { error: string }> {
  const { data, error } = await admin.rpc("claim_quiz_generation_v2", {
    p_user_id: userId,
    p_note_id: noteId,
    p_quiz_type: quizType,
  });

  if (error) {
    console.error("[generateQuiz] 사용량 확인 실패:", error.message);
    return { error: QUIZ_ERROR_MESSAGES.generationFailed };
  }

  const claim = claimResultSchema.safeParse(data);

  if (!claim.success) {
    console.error("[generateQuiz] 선점 응답 형식이 올바르지 않음");
    return { error: QUIZ_ERROR_MESSAGES.generationFailed };
  }

  if (claim.data.status === "ok" && claim.data.claimToken) {
    return { ok: true, claimToken: claim.data.claimToken };
  }

  return {
    error:
      CLAIM_ERROR_MESSAGES[claim.data.status] ??
      QUIZ_ERROR_MESSAGES.generationFailed,
  };
}

type FinalizeGenerationResult =
  /** 캐시에 저장하고 사용자에게 퀴즈를 돌려준다. */
  | { shouldSave: true; blocked: false }
  /**
   * finalize RPC 자체가 실패해 "이게 최신 선점인지" 판단할 수 없다.
   * 캐시 정합성이 우선이므로 저장은 하지 않되, 이미 받은 유효한 퀴즈까지
   * 버릴 이유는 없으므로 사용자에게는 돌려준다.
   */
  | { shouldSave: false; blocked: false }
  /** 더 새로운 선점이 생겼거나 선점 행 자체를 찾지 못함 — 저장도, 반환도 하지 않는다. */
  | { shouldSave: false; blocked: true; error: string };

/**
 * 선점해 둔 행을 완료로 확정한다. saveQuiz()의 게이트다.
 * stale된 요청이 최신 요청의 결과를 뒤늦게 덮어쓰지 않도록, 이 결과를 보고
 * 저장 여부를 가른다.
 */
async function finalizeGeneration(
  admin: ReturnType<typeof createAdminClient>,
  params: {
    userId: string;
    noteId: string;
    quizType: QuizType;
    claimToken: string;
  },
): Promise<FinalizeGenerationResult> {
  const { data, error } = await admin.rpc("finalize_quiz_generation_v2", {
    p_user_id: params.userId,
    p_note_id: params.noteId,
    p_quiz_type: params.quizType,
    p_claim_token: params.claimToken,
  });

  if (error) {
    console.error("[generateQuiz] 생성 확정 실패:", error.message);
    return { shouldSave: false, blocked: false };
  }

  if (data === "ok" || data === "already_completed") {
    return { shouldSave: true, blocked: false };
  }

  if (data === "stale_claim") {
    return {
      shouldSave: false,
      blocked: true,
      error: QUIZ_ERROR_MESSAGES.staleClaim,
    };
  }

  // not_found 등 예상 밖 상태. 선점 자체가 이 함수 안에서 방금 만든 것이라 정상 경로에서는 나오지 않는다.
  console.error(`[generateQuiz] 예상치 못한 finalize 상태: ${String(data)}`);
  return {
    shouldSave: false,
    blocked: true,
    error: QUIZ_ERROR_MESSAGES.generationFailed,
  };
}

async function createQuiz(
  noteId: string,
  quizType: string,
  options: { useCache: boolean },
): Promise<GenerateQuizResult> {
  const parsed = parseInput(noteId, quizType);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: QUIZ_ERROR_MESSAGES.unauthenticated };
  }

  const { data: note } = await supabase
    .from("notes")
    .select("title, content")
    .eq("id", parsed.data.noteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!note) {
    return { error: QUIZ_ERROR_MESSAGES.noteNotFound };
  }

  const cacheKey = await buildCacheKey(note.title, note.content);

  // 재생성일 때도 캐시를 읽는다. 반환하지는 않고 "이미 낸 문제" 목록으로만 쓴다.
  const cache = await loadCache(supabase, {
    noteId: parsed.data.noteId,
    quizType: parsed.data.quizType,
    cacheKey,
  });

  if (options.useCache && cache?.questions) {
    return { data: { questions: cache.questions, isNew: false } };
  }

  const history = cache?.history ?? [];

  // 두 RPC는 service_role 전용이다. authenticated에 열어 두면 사용자가 PostgREST로
  // claim → finalize를 직접 호출해 AI 없이 캐시를 채울 수 있다. 위에서 이미 세션·노트
  // 소유권을 확인했으므로 여기서만 admin 클라이언트를 쓴다.
  const admin = createAdminClient();

  // 사용량 선점은 캐시 확인 뒤에 온다. 한도를 다 써도 이미 만든 퀴즈는 볼 수 있어야 한다.
  // 선점한 사용량은 되돌리지 않는다. 되돌리는 RPC를 두면 사용자가 직접 호출해 한도를 무력화한다.
  const claimed = await claimGeneration(
    admin,
    user.id,
    parsed.data.noteId,
    parsed.data.quizType,
  );

  if ("error" in claimed) {
    return { error: claimed.error };
  }

  const generated = await requestQuestions({
    title: note.title,
    content: note.content,
    quizType: parsed.data.quizType,
    previousQuestions: flattenHistory(history),
    temperature: options.useCache
      ? TEMPERATURE.initial
      : TEMPERATURE.regenerate,
  });

  if ("error" in generated) {
    return { error: generated.error };
  }

  // AI 호출 → JSON.parse → Zod 검증을 통과한 직후에만 finalize를 부른다.
  // 그 전 단계가 실패하면 선점 행은 미완료로 남아 in-flight 창이 지날 때까지
  // 재시도를 막는다 — 의도된 동작이다(과금만 나가고 결과가 없는 반복 호출을 막는다).
  const finalized = await finalizeGeneration(admin, {
    userId: user.id,
    noteId: parsed.data.noteId,
    quizType: parsed.data.quizType,
    claimToken: claimed.claimToken,
  });

  if (finalized.shouldSave) {
    await saveQuiz(supabase, {
      noteId: parsed.data.noteId,
      userId: user.id,
      quizType: parsed.data.quizType,
      questions: generated.data,
      history,
      cacheKey,
    });
  }

  if (finalized.blocked) {
    return { error: finalized.error };
  }

  return { data: { questions: generated.data, isNew: true } };
}

export async function generateQuiz(
  noteId: string,
  quizType: string,
): Promise<GenerateQuizResult> {
  return createQuiz(noteId, quizType, { useCache: true });
}

/**
 * 캐시를 무시하고 새로 생성한다.
 * 기존 캐시는 미리 지우지 않는다. 생성이 실패해도 이전 퀴즈가 남아 있어야 하기 때문이다.
 */
export async function regenerateQuiz(
  noteId: string,
  quizType: string,
): Promise<GenerateQuizResult> {
  return createQuiz(noteId, quizType, { useCache: false });
}
