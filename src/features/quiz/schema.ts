import { z } from "zod";

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

export const quizQuestionSchema = z.discriminatedUnion("type", [
  oxQuestionSchema,
  blankQuestionSchema,
]);

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(20),
});

export type OxQuestion = z.infer<typeof oxQuestionSchema>;
export type BlankQuestion = z.infer<typeof blankQuestionSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizResponse = z.infer<typeof quizResponseSchema>;
