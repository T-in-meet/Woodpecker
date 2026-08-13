"use server";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../utils/require-admin";
import { uuidSchema } from "../schema";
import { AdminAiActionResult } from "../types";
import { readFormBoolean, readFormString } from "../utils/form-data";
import { reportAdminAiActionError } from "../utils/report-admin-ai-action-error";
import { revalidateAdminAiPaths } from "../utils/revalidate";
import { getAdminAiModelDetail } from "./queries";
import { createModelSchema, updateModelSchema } from "./schema";

/**
 * FormData에서 AI 모델 생성 입력을 읽어 검증하고 정규화합니다.
 *
 * @param formData 모델 생성 FormData
 * @returns 모델 생성 입력 검증 결과
 */
function parseCreateModelInput(formData: FormData) {
  return createModelSchema.safeParse({
    capability: readFormString(formData, "capability"),
    dimensions: readFormString(formData, "dimensions"),
    displayName: readFormString(formData, "displayName"),
    distanceMetric: readFormString(formData, "distanceMetric"),
    isActive: readFormBoolean(formData, "isActive"),
    model: readFormString(formData, "model"),
    notes: readFormString(formData, "notes"),
    provider: readFormString(formData, "provider"),
  });
}

/**
 * AI 모델 설정을 생성합니다.
 *
 * @param formData 모델 생성 입력
 * @returns mutation 결과
 */
export async function createAdminAiModel(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = parseCreateModelInput(formData);

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_model_configs")
    .insert({
      capability: parsedInput.data.capability,
      dimensions: parsedInput.data.dimensions,
      display_name: parsedInput.data.displayName,
      distance_metric: parsedInput.data.distanceMetric,
      is_active: parsedInput.data.isActive,
      model: parsedInput.data.model,
      notes: parsedInput.data.notes,
      provider: parsedInput.data.provider,
    })
    .select("id")
    .single();

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_CREATE_FAILED,
      message: "관리자 AI 모델 생성에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_MODEL_CONFIG,
    });

    return { message: error.message, ok: false };
  }

  revalidateAdminAiPaths();

  return { id: data.id, ok: true };
}

/**
 * AI 모델 설정의 운영 필드를 수정합니다.
 *
 * @param formData 모델 수정 입력
 * @returns mutation 결과
 */
export async function updateAdminAiModel(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = updateModelSchema.safeParse({
    displayName: readFormString(formData, "displayName"),
    isActive: readFormBoolean(formData, "isActive"),
    modelConfigId: readFormString(formData, "modelConfigId"),
    notes: readFormString(formData, "notes"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ai_model_configs")
    .update({
      display_name: parsedInput.data.displayName,
      is_active: parsedInput.data.isActive,
      notes: parsedInput.data.notes,
    })
    .eq("id", parsedInput.data.modelConfigId);

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_UPDATE_FAILED,
      message: "관리자 AI 모델 수정에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_MODEL_CONFIG,
    });

    return { message: error.message, ok: false };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI 모델 설정을 삭제합니다.
 *
 * @param modelConfigId 삭제할 모델 설정 ID
 * @returns mutation 결과
 */
export async function deleteAdminAiModel(
  modelConfigId: string,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedId = uuidSchema.safeParse(modelConfigId);

  if (!parsedId.success) {
    return { message: "모델 ID가 올바르지 않습니다.", ok: false };
  }

  const model = await getAdminAiModelDetail(parsedId.data);

  if (!model) {
    return { message: "모델을 찾을 수 없습니다.", ok: false };
  }

  if (model.isActive || model.embeddingReferenceCount > 0) {
    return {
      message: "활성 모델, embedding 참조가 있는 모델은 삭제할 수 없습니다.",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ai_model_configs")
    .delete()
    .eq("id", parsedId.data);

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_DELETE_FAILED,
      message: "관리자 AI 모델 삭제에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_MODEL_CONFIG,
    });

    return { message: error.message, ok: false };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}
