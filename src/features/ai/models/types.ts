import type { z } from "zod";

import type { aiModelConfigRowSchema } from "./schema";

/** DB에서 조회한 AI model config 행입니다. */
export type AiModelConfig = z.infer<typeof aiModelConfigRowSchema>;
