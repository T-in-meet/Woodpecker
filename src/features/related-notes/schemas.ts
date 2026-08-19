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

/**
 * 사용자가 수동 Related Note를 추가할 때 전달하는 입력을 검증합니다.
 *
 * Note 소유권, 자기 자신 연결 금지, 기존 관계 전환 등의 관계 규칙은
 * DB RPC에서 최종적으로 검증합니다.
 */
const manualRelatedNoteInputSchema = z.object({
  /** 수동으로 연결할 Related Note ID입니다. */
  relatedNoteId: z.string().uuid(),

  /** 해당 Related Note에 작성할 선택적 연결 이유입니다. */
  reason: z
    .string()
    .trim()
    .max(500, "연결 이유는 500자 이하로 입력해주세요.")
    .optional(),
});

/**
 * 사용자가 여러 Related Notes를 한 번에 수동 추가할 때 전달하는 입력을 검증합니다.
 *
 * 각 Related Note는 개별적인 선택적 reason을 가질 수 있습니다.
 *
 * Note 소유권, 자기 자신 연결 금지, 기존 관계 전환 등의 관계 규칙은
 * DB RPC에서 최종적으로 검증합니다.
 */
export const addManualRelatedNotesSchema = z.object({
  /** Related Notes를 추가할 기준 Note ID입니다. */
  noteId: z.string().uuid(),

  /** 한 번에 추가할 Related Notes 목록입니다. */
  relatedNotes: z
    .array(manualRelatedNoteInputSchema)
    .min(1, "추가할 관련 노트를 하나 이상 선택해주세요."),
});

export type AddManualRelatedNotesInput = z.infer<
  typeof addManualRelatedNotesSchema
>;

/**
 * manual Related Note의 연결 이유를 수정할 때 전달하는 입력을 검증합니다.
 *
 * 관계 존재 여부, 소유권, manual 관계 여부는 DB RPC에서 최종 검증합니다.
 */
export const updateManualRelatedNoteReasonSchema = z.object({
  /** Related Note를 수정할 기준 Note ID입니다. */
  noteId: z.string().uuid(),

  /** 수정할 Related Note ID입니다. */
  relatedNoteId: z.string().uuid(),

  /** 수정할 선택적 연결 이유입니다. */
  reason: z
    .string()
    .trim()
    .max(500, "연결 이유는 500자 이하로 입력해주세요.")
    .optional(),
});

export type UpdateManualRelatedNoteReasonInput = z.infer<
  typeof updateManualRelatedNoteReasonSchema
>;
