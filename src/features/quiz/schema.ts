import { z } from "zod";

import { CHOICE_OPTION_COUNT, QUIZ_TYPES } from "@/lib/gemini/prompts";

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

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(20),
});

export type OxQuestion = z.infer<typeof oxQuestionSchema>;
export type BlankQuestion = z.infer<typeof blankQuestionSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizResponse = z.infer<typeof quizResponseSchema>;
