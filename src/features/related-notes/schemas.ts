import { z } from "zod";

import { isJsonValue } from "@/lib/supabase/utils/is-json-value";
import type { Json } from "@/types/db.helpers";

/**
 * Related Note에 저장된 metadata를 검증합니다.
 *
 * 화면 표시에 필요한 제목 snapshot은 필수이며,
 * 그 외 Json-compatible 확장 필드를 허용합니다.
 */
export const relatedNoteMetadataSchema = z
  .object({
    title: z.string().trim().min(1),
  })
  .catchall(z.custom<Json>(isJsonValue));

/**
 * Related Notes 조회 결과 row를 검증합니다.
 */
export const relatedNoteRowSchema = z.object({
  related_note_id: z.string().uuid(),
  origin: z.enum(["manual", "ai"]),
  metadata: relatedNoteMetadataSchema,
});
