import { z } from "zod";

import { isJsonValue } from "@/lib/supabase/utils/is-json-value";
import type { Json } from "@/types/db.helpers";

/**
 * Related Note에 공통으로 저장되는 metadata를 검증합니다.
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
 * manual Related Note에 저장된 metadata를 검증합니다.
 *
 * 사용자가 연결 이유를 입력하지 않을 수 있으므로 reason은 선택적입니다.
 */
export const manualRelatedNoteMetadataSchema = relatedNoteMetadataSchema.extend(
  {
    reason: z
      .string()
      .trim()
      .max(500, "연결 이유는 500자 이하로 입력해주세요.")
      .optional(),
  },
);

/**
 * AI Related Note에 저장된 metadata를 검증합니다.
 *
 * AI 추천 결과에는 추천 이유가 항상 포함되어야 하므로 reason은 필수입니다.
 */
export const aiRelatedNoteMetadataSchema = relatedNoteMetadataSchema.extend({
  reason: z.string().trim().min(1),
});

/**
 * Related Notes 조회 결과 row를 검증합니다.
 *
 * 관계의 origin에 따라 metadata 계약이 다릅니다.
 *
 * manual 관계는 사용자가 연결 이유를 입력하지 않을 수 있지만,
 * AI 관계는 추천 생성 시 reason을 반드시 저장합니다.
 */
export const relatedNoteRowSchema = z.discriminatedUnion("origin", [
  z.object({
    related_note_id: z.string().uuid(),
    origin: z.literal("manual"),
    metadata: manualRelatedNoteMetadataSchema,
  }),
  z.object({
    related_note_id: z.string().uuid(),
    origin: z.literal("ai"),
    metadata: aiRelatedNoteMetadataSchema,
  }),
]);

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

/**
 * Related Note 관계를 삭제할 때 전달하는 입력을 검증합니다.
 *
 * 관계의 origin과 소유권은 Client 입력을 신뢰하지 않고
 * DB RPC에서 실제 저장된 데이터를 기준으로 최종 검증합니다.
 */
export const deleteRelatedNoteSchema = z.object({
  /** Related Notes가 연결된 기준 Note ID입니다. */
  noteId: z.string().uuid(),

  /** 삭제할 Related Note ID입니다. */
  relatedNoteId: z.string().uuid(),
});

export type DeleteRelatedNoteInput = z.infer<typeof deleteRelatedNoteSchema>;
