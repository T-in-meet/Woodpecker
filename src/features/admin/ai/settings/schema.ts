import { z } from "zod";

/**
 * @description AI 설정 생성 입력값을 검증합니다.
 */
export const adminAiSettingCreateInputSchema = z.object({
  displayName: z.string().trim().min(1),
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim(),
});

/**
 * @description AI 설정 생성 입력값입니다.
 */
export type AdminAiSettingCreateInput = z.infer<
  typeof adminAiSettingCreateInputSchema
>;

/**
 * @description AI 설정 수정 입력값을 검증합니다.
 */
export const adminAiSettingUpdateInputSchema = z.object({
  settingId: z.uuid(),
  displayName: z.string().trim().min(1),
  description: z.string().trim(),
});

/**
 * @description AI 설정 수정 입력값입니다.
 */
export type AdminAiSettingUpdateInput = z.infer<
  typeof adminAiSettingUpdateInputSchema
>;

/**
 * @description AI 설정 삭제 입력값을 검증합니다.
 */
export const adminAiSettingDeleteInputSchema = z.object({
  settingId: z.uuid(),
});

export type AdminAiSettingDeleteInput = z.infer<
  typeof adminAiSettingDeleteInputSchema
>;

const adminAiSettingChatConfigurationSaveSchema = z.object({
  kind: z.literal("chat"),
  roleKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  promptVersionId: z.uuid(),
  modelConfigId: z.uuid(),
  temperature: z.number().min(0).max(2),
});

const adminAiSettingEmbeddingConfigurationSaveSchema = z.object({
  kind: z.literal("embedding"),
  roleKey: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  modelConfigId: z.uuid(),
});

/**
 * @description AI 설정의 Configuration 전체 저장 입력값을 검증합니다.
 */
export const adminAiSettingConfigurationsSaveInputSchema = z.object({
  settingId: z.uuid(),
  configurations: z.array(
    z.discriminatedUnion("kind", [
      adminAiSettingChatConfigurationSaveSchema,
      adminAiSettingEmbeddingConfigurationSaveSchema,
    ]),
  ),
});

/**
 * @description AI 설정의 Configuration 전체 저장 입력값입니다.
 */
export type AdminAiSettingConfigurationsSaveInput = z.infer<
  typeof adminAiSettingConfigurationsSaveInputSchema
>;

export const adminAiSettingListBadgeItemSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
});

export const adminAiSettingListRowSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  key: z.string(),
  agents: z.array(adminAiSettingListBadgeItemSchema),
  chatModels: z.array(adminAiSettingListBadgeItemSchema),
  embeddingModels: z.array(adminAiSettingListBadgeItemSchema),
  chatConfigurationCount: z.number().int().nonnegative(),
  embeddingConfigurationCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const adminAiSettingListRpcResultSchema = z.object({
  items: z.array(adminAiSettingListRowSchema),
  total_count: z.number().int().nonnegative(),
});
