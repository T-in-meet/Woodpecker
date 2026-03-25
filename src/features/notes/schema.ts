import { z } from "zod";

export const recordSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요").max(100),
  content: z.string().min(1, "내용을 입력해주세요"),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type RecordInput = z.infer<typeof recordSchema>;
