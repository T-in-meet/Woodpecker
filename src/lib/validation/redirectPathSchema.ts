import { z } from "zod";

export const redirectPathSchema = z
  .string()
  .startsWith("/")
  .refine((value) => !value.startsWith("//"));

export type RedirectPath = z.infer<typeof redirectPathSchema>;
