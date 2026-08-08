import { z } from "zod";

import {
  CHOICE_OPTION_COUNT,
  QUIZ_TYPES,
  type QuizType,
} from "@/lib/gemini/prompts";

// Server Action 인자는 조작될 수 있으므로 타입이 아니라 런타임에서 검증한다.
export const quizTypeSchema = z.enum(QUIZ_TYPES);

const oxQuestionSchema = z.object({
  type: z.literal("ox"),
  question: z.string().min(1),
  answer: z.boolean(),
  explanation: z.string().min(1),
});

const blankQuestionSchema = z.object({
  type: z.literal("blank"),
  question: z.string().min(1),
  answer: z.string().min(1),
  acceptedAnswers: z.array(z.string()).default([]),
  explanation: z.string().min(1),
});

// answer는 options 안에서 정답의 위치(0부터 시작)를 가리킨다.
const choiceQuestionSchema = z.object({
  type: z.literal("choice"),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(CHOICE_OPTION_COUNT),
  answer: z
    .number()
    .int()
    .min(0)
    .max(CHOICE_OPTION_COUNT - 1),
  explanation: z.string().min(1),
});

export const quizQuestionSchema = z.discriminatedUnion("type", [
  oxQuestionSchema,
  blankQuestionSchema,
  choiceQuestionSchema,
]);

const QUESTION_SCHEMA_BY_TYPE = {
  ox: oxQuestionSchema,
  blank: blankQuestionSchema,
  choice: choiceQuestionSchema,
} as const;

/**
 * 요청한 유형의 문항만 통과시키는 응답 스키마.
 * 유형을 섞어 받으면 quiz_type이 다른 행에 그대로 캐시되어,
 * 이후 그 유형을 고를 때마다 잘못된 문항이 반복해서 나온다.
 */
export function quizResponseSchemaFor(quizType: QuizType) {
  return z.object({
    questions: z.array(QUESTION_SCHEMA_BY_TYPE[quizType]).min(1).max(20),
  });
}

export type OxQuestion = z.infer<typeof oxQuestionSchema>;
export type BlankQuestion = z.infer<typeof blankQuestionSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
