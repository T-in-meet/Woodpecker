"use server";

import { z } from "zod";

import { getGemini } from "@/lib/gemini/client";
import {
  buildQuizPrompt,
  getQuestionRange,
  type QuizType,
} from "@/lib/gemini/prompts";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

import {
  type QuizQuestion,
  quizResponseSchema,
  quizTypeSchema,
} from "./schema";

const noteIdSchema = z.string().uuid();

const GENERATION_FAILED =
  "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.";
const PARSE_FAILED = "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.";

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
 */
async function buildCacheKey(
  title: string,
  content: string,
  quizType: QuizType,
): Promise<string> {
  const hash = await hashContent(`${title}\n${content}`);
  return `${hash}:${quizType}`;
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
    return { error: "유효하지 않은 노트입니다." };
  }

  const parsedType = quizTypeSchema.safeParse(quizType);
  if (!parsedType.success) {
    return { error: "유효하지 않은 퀴즈 유형입니다." };
  }

  return { data: { noteId: parsedId.data, quizType: parsedType.data } };
}

async function requestQuestions(
  title: string,
  content: string,
  quizType: QuizType,
): Promise<{ data: QuizQuestion[] } | { error: string }> {
  const questionRange = getQuestionRange(content.length);
  const prompt = buildQuizPrompt(title, content, questionRange, quizType);

  let responseText: string;
  try {
    // 키가 없으면 이 줄에서 에러가 나고 아래 catch가 받아 준다.
    const response = await getGemini().models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    responseText = response.text ?? "";
  } catch (e) {
    console.error("[generateQuiz] Gemini API 호출 실패:", e);
    return { error: GENERATION_FAILED };
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
    return { error: PARSE_FAILED };
  }

  const parsed = quizResponseSchema.safeParse(json);
  if (!parsed.success) {
    console.error(
      `[generateQuiz] Zod 파싱 실패 (응답 길이 ${responseText.length}):`,
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
      })),
    );
    return { error: PARSE_FAILED };
  }

  return { data: parsed.data.questions };
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
    questions: QuizQuestion[];
    cacheKey: string;
  },
): Promise<void> {
  const { error } = await supabase.from("quizzes").upsert(
    {
      note_id: params.noteId,
      user_id: params.userId,
      questions: JSON.parse(JSON.stringify(params.questions)) as Json,
      note_content_hash: params.cacheKey,
    },
    { onConflict: "note_id" },
  );

  if (error) {
    console.error("[generateQuiz] 퀴즈 캐시 저장 실패:", error.message);
  }
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
    return { error: "로그인이 필요합니다." };
  }

  const { data: note } = await supabase
    .from("notes")
    .select("title, content")
    .eq("id", parsed.data.noteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!note) {
    return { error: "노트를 찾을 수 없습니다." };
  }

  const cacheKey = await buildCacheKey(
    note.title,
    note.content,
    parsed.data.quizType,
  );

  if (options.useCache) {
    const { data: cached } = await supabase
      .from("quizzes")
      .select("questions, note_content_hash")
      .eq("note_id", parsed.data.noteId)
      .maybeSingle();

    if (cached && cached.note_content_hash === cacheKey) {
      const cachedQuestions = quizResponseSchema.safeParse({
        questions: cached.questions,
      });

      if (cachedQuestions.success) {
        return {
          data: { questions: cachedQuestions.data.questions, isNew: false },
        };
      }
    }
  }

  const generated = await requestQuestions(
    note.title,
    note.content,
    parsed.data.quizType,
  );

  if ("error" in generated) {
    return { error: generated.error };
  }

  await saveQuiz(supabase, {
    noteId: parsed.data.noteId,
    userId: user.id,
    questions: generated.data,
    cacheKey,
  });

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
