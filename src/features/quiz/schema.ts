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

const multipleChoiceQuestionSchema = z.object({
  type: z.literal("multiple_choice"),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
});

export const quizQuestionSchema = z.discriminatedUnion("type", [
  oxQuestionSchema,
  blankQuestionSchema,
  multipleChoiceQuestionSchema,
]);

export const quizResponseSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1).max(10),
});

export type OxQuestion = z.infer<typeof oxQuestionSchema>;
export type BlankQuestion = z.infer<typeof blankQuestionSchema>;
export type MultipleChoiceQuestion = z.infer<
  typeof multipleChoiceQuestionSchema
>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizResponse = z.infer<typeof quizResponseSchema>;
