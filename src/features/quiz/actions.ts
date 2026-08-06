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

import { type QuizQuestion, quizResponseSchema } from "./schema";

const noteIdSchema = z.string().uuid();

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

export async function generateQuiz(
  noteId: string,
  quizType: QuizType,
): Promise<GenerateQuizResult> {
  const parsedId = noteIdSchema.safeParse(noteId);
  if (!parsedId.success) {
    return { error: "유효하지 않은 노트입니다." };
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
    .eq("id", parsedId.data)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!note) {
    return { error: "노트를 찾을 수 없습니다." };
  }

  const contentHash = await hashContent(note.content);
  const cacheKey = `${contentHash}:${quizType}`;

  const { data: cached } = await supabase
    .from("quizzes")
    .select("questions, note_content_hash")
    .eq("note_id", parsedId.data)
    .maybeSingle();

  if (cached && cached.note_content_hash === cacheKey) {
    const parsed = quizResponseSchema.safeParse({
      questions: cached.questions,
    });
    if (parsed.success) {
      return { data: { questions: parsed.data.questions, isNew: false } };
    }
  }

  const questionRange = getQuestionRange(note.content.length);
  const prompt = buildQuizPrompt(
    note.title,
    note.content,
    questionRange,
    quizType,
  );

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
    return { error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  let parsed;
  try {
    const json: unknown = JSON.parse(responseText);
    parsed = quizResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[generateQuiz] Zod 파싱 실패:", parsed.error.issues);
      console.error("[generateQuiz] 원본 응답:", responseText);
    }
  } catch (e) {
    console.error("[generateQuiz] JSON 파싱 실패:", e);
    console.error("[generateQuiz] 원본 응답:", responseText);
    return { error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요." };
  }

  if (!parsed.success) {
    return { error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요." };
  }

  if (cached) {
    await supabase
      .from("quizzes")
      .update({
        questions: JSON.parse(JSON.stringify(parsed.data.questions)) as Json,
        note_content_hash: cacheKey,
      })
      .eq("note_id", parsedId.data);
  } else {
    await supabase.from("quizzes").insert({
      note_id: parsedId.data,
      user_id: user.id,
      questions: JSON.parse(JSON.stringify(parsed.data.questions)) as Json,
      note_content_hash: cacheKey,
    });
  }

  return { data: { questions: parsed.data.questions, isNew: true } };
}

export async function regenerateQuiz(
  noteId: string,
  quizType: QuizType,
): Promise<GenerateQuizResult> {
  const parsedId = noteIdSchema.safeParse(noteId);
  if (!parsedId.success) {
    return { error: "유효하지 않은 노트입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  await supabase.from("quizzes").delete().eq("note_id", parsedId.data);

  return generateQuiz(noteId, quizType);
}
