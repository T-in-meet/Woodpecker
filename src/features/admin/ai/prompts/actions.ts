"use server";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../utils/require-admin";
import { uuidSchema } from "../schema";
import type { AdminAiActionResult } from "../types";
import { readFormString } from "../utils/form-data";
import { reportAdminAiActionError } from "../utils/report-admin-ai-action-error";
import { revalidateAdminAiPaths } from "../utils/revalidate";
import { getAdminAiPromptVersionDetail } from "./queries";
import {
  createFamilySchema,
  createVersionSchema,
  updateFamilySchema,
  updateVersionSchema,
} from "./schema";

/**
 * AI prompt family와 v1 draft version을 함께 생성합니다.
 *
 * @param formData prompt family 생성 입력
 * @returns mutation 결과
 */
export async function createAdminAiPromptFamily(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = createFamilySchema.safeParse({
    agentId: readFormString(formData, "agentId"),
    changeSummary: readFormString(formData, "changeSummary"),
    description: readFormString(formData, "description"),
    displayName: readFormString(formData, "displayName"),
    responseSchema: readFormString(formData, "responseSchema"),
    systemTemplate: readFormString(formData, "systemTemplate"),
    tags: readFormString(formData, "tags"),
    userTemplate: readFormString(formData, "userTemplate"),
    variables: readFormString(formData, "variables"),
    versionDisplayName: readFormString(formData, "versionDisplayName"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "create_ai_prompt_family_with_initial_version",
    {
      p_admin_user_id: adminUserId,
      p_agent_id: parsedInput.data.agentId,
      p_change_summary: parsedInput.data.changeSummary ?? "",
      p_description: parsedInput.data.description ?? "",
      p_display_name: parsedInput.data.displayName,
      p_response_schema: parsedInput.data.responseSchema,
      p_system_template: parsedInput.data.systemTemplate,
      p_tags: parsedInput.data.tags,
      p_user_template: parsedInput.data.userTemplate,
      p_variables: parsedInput.data.variables,
      p_version_display_name: parsedInput.data.versionDisplayName,
    },
  );

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_CREATE_FAILED,
      message: "관리자 AI prompt family 생성에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_PROMPT_FAMILY,
    });

    return {
      message: "Prompt Family를 생성하지 못했습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { id: data, ok: true };
}

/**
 * AI prompt family 운영 필드를 수정합니다.
 *
 * @param formData prompt family 수정 입력
 * @returns mutation 결과
 */
export async function updateAdminAiPromptFamily(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = updateFamilySchema.safeParse({
    description: readFormString(formData, "description"),
    displayName: readFormString(formData, "displayName"),
    familyId: readFormString(formData, "familyId"),
    tags: readFormString(formData, "tags"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ai_prompt_families")
    .update({
      description: parsedInput.data.description,
      display_name: parsedInput.data.displayName,
      tags: parsedInput.data.tags,
    })
    .eq("id", parsedInput.data.familyId);

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_UPDATE_FAILED,
      message: "관리자 AI prompt family 수정에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_PROMPT_FAMILY,
    });

    return {
      message: "Prompt Family를 수정하지 못했습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI prompt family를 제한 조건 안에서 삭제합니다.
 *
 * @param familyId 삭제할 family ID
 * @returns mutation 결과
 */
export async function deleteAdminAiPromptFamily(
  familyId: string,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedId = uuidSchema.safeParse(familyId);

  if (!parsedId.success) {
    return { message: "Prompt family ID가 올바르지 않습니다.", ok: false };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("delete_admin_ai_prompt_family", {
    p_family_id: parsedId.data,
  });

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_DELETE_FAILED,
      message: "관리자 AI prompt family 삭제에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_PROMPT_FAMILY,
    });

    return {
      message: "Prompt Family를 삭제하지 못했습니다.",
      ok: false,
    };
  }

  if (data === "NOT_FOUND") {
    return { message: "Prompt family를 찾을 수 없습니다.", ok: false };
  }

  if (data !== "OK") {
    return {
      message:
        "시스템 관리 Prompt Family이거나 AI 설정에서 사용 중인 Version이 있는 Family는 삭제할 수 없습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI prompt version draft를 생성합니다.
 *
 * @param formData version 생성 입력
 * @returns mutation 결과
 */
export async function createAdminAiPromptVersion(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = createVersionSchema.safeParse({
    changeSummary: readFormString(formData, "changeSummary"),
    familyId: readFormString(formData, "familyId"),
    responseSchema: readFormString(formData, "responseSchema"),
    systemTemplate: readFormString(formData, "systemTemplate"),
    tags: readFormString(formData, "tags"),
    userTemplate: readFormString(formData, "userTemplate"),
    variables: readFormString(formData, "variables"),
    versionDisplayName: readFormString(formData, "versionDisplayName"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_ai_prompt_version", {
    p_admin_user_id: adminUserId,
    p_change_summary: parsedInput.data.changeSummary ?? "",
    p_display_name: parsedInput.data.versionDisplayName,
    p_family_id: parsedInput.data.familyId,
    p_response_schema: parsedInput.data.responseSchema,
    p_system_template: parsedInput.data.systemTemplate,
    p_tags: parsedInput.data.tags,
    p_user_template: parsedInput.data.userTemplate,
    p_variables: parsedInput.data.variables,
  });

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_CREATE_FAILED,
      message: "관리자 AI prompt version 생성에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_PROMPT_VERSION,
    });

    return {
      message: "Prompt Version을 생성하지 못했습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { id: data, ok: true };
}

/**
 * AI prompt version을 lifecycle 정책에 따라 수정합니다.
 *
 * Draft Version은 모든 수정 가능 필드를 변경할 수 있습니다.
 * Published Version은 System/User Template을 제외한 필드만 변경할 수 있습니다.
 * Archived Version은 수정할 수 없습니다.
 *
 * 사전 조회와 실제 수정 사이에 lifecycle 상태가 변경될 수 있으므로,
 * UPDATE에서도 조회한 lifecycle 상태를 다시 확인하고 실제 수정 여부를 검증합니다.
 *
 * @param formData version 수정 입력
 * @returns mutation 결과
 */
export async function updateAdminAiPromptVersion(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = updateVersionSchema.safeParse({
    changeSummary: readFormString(formData, "changeSummary"),
    familyId: readFormString(formData, "familyId"),
    responseSchema: readFormString(formData, "responseSchema"),
    systemTemplate: readFormString(formData, "systemTemplate"),
    tags: readFormString(formData, "tags"),
    userTemplate: readFormString(formData, "userTemplate"),
    variables: readFormString(formData, "variables"),
    versionDisplayName: readFormString(formData, "versionDisplayName"),
    versionId: readFormString(formData, "versionId"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const current = await getAdminAiPromptVersionDetail(
    parsedInput.data.familyId,
    parsedInput.data.versionId,
  );

  if (!current) {
    return {
      message: "Prompt Version을 찾을 수 없습니다.",
      ok: false,
    };
  }

  if (current.version.lifecycleStatus === "archived") {
    return {
      message: "Archived Version은 수정할 수 없습니다.",
      ok: false,
    };
  }

  const lifecycleStatus = current.version.lifecycleStatus;

  const commonUpdate = {
    change_summary: parsedInput.data.changeSummary,
    display_name: parsedInput.data.versionDisplayName,
    response_schema: parsedInput.data.responseSchema,
    tags: parsedInput.data.tags,
    variables: parsedInput.data.variables,
  };

  const update =
    lifecycleStatus === "draft"
      ? {
          ...commonUpdate,
          system_template: parsedInput.data.systemTemplate,
          user_template: parsedInput.data.userTemplate,
        }
      : commonUpdate;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_versions")
    .update(update)
    .eq("id", parsedInput.data.versionId)
    .eq("lifecycle_status", lifecycleStatus)
    .select("id")
    .maybeSingle();

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_UPDATE_FAILED,
      message: "관리자 AI prompt version 수정에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_PROMPT_VERSION,
    });

    return {
      message: "Prompt Version을 수정하지 못했습니다.",
      ok: false,
    };
  }

  // 사전 조회 이후 lifecycle 상태가 변경된 경우 0건 수정될 수 있다.
  if (!data) {
    return {
      message: "Prompt Version 상태가 변경되었습니다. 다시 시도해주세요.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI prompt draft 또는 archived version을 published 상태로 전환합니다.
 *
 * @param versionId 전환할 version ID
 * @returns mutation 결과
 */
export async function publishAdminAiPromptVersion(
  versionId: string,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedId = uuidSchema.safeParse(versionId);

  if (!parsedId.success) {
    return { message: "Version ID가 올바르지 않습니다.", ok: false };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("publish_ai_prompt_version", {
    p_version_id: parsedId.data,
  });

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_PUBLISH_FAILED,
      message: "관리자 AI prompt version publish에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.PUBLISH_PROMPT_VERSION,
    });

    return {
      message: "Prompt Version을 Publish하지 못했습니다.",
      ok: false,
    };
  }

  if (data !== "OK") {
    return {
      message: "draft 또는 archived version만 publish할 수 있습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI prompt version을 archived 상태로 전환합니다.
 *
 * @param versionId archive할 version ID
 * @returns mutation 결과
 */
export async function archiveAdminAiPromptVersion(
  versionId: string,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedId = uuidSchema.safeParse(versionId);

  if (!parsedId.success) {
    return { message: "Version ID가 올바르지 않습니다.", ok: false };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("archive_ai_prompt_version", {
    p_version_id: parsedId.data,
  });

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_ARCHIVE_FAILED,
      message: "관리자 AI prompt version archive에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.ARCHIVE_PROMPT_VERSION,
    });

    return {
      message: "Prompt Version을 Archive하지 못했습니다.",
      ok: false,
    };
  }

  if (data !== "OK") {
    return {
      message: "published version만 archive할 수 있습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI prompt version을 삭제합니다.
 *
 * published version은 삭제할 수 없으며,
 * draft와 archived version만 삭제할 수 있습니다.
 *
 * 사전 조회와 실제 삭제 사이에 lifecycle 상태가 변경될 수 있으므로,
 * DELETE에서도 published가 아닌지 다시 확인하고 실제 삭제 여부를 검증합니다.
 *
 * @param familyId version이 속한 family ID
 * @param versionId 삭제할 version ID
 * @returns mutation 결과
 */
export async function deleteAdminAiPromptVersion(
  familyId: string,
  versionId: string,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedFamilyId = uuidSchema.safeParse(familyId);
  const parsedVersionId = uuidSchema.safeParse(versionId);

  if (!parsedFamilyId.success || !parsedVersionId.success) {
    return { message: "Version ID가 올바르지 않습니다.", ok: false };
  }

  const current = await getAdminAiPromptVersionDetail(
    parsedFamilyId.data,
    parsedVersionId.data,
  );

  if (!current) {
    return { message: "Version을 찾을 수 없습니다.", ok: false };
  }

  if (current.version.lifecycleStatus === "published") {
    return { message: "published version은 삭제할 수 없습니다.", ok: false };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_versions")
    .delete()
    .eq("id", parsedVersionId.data)
    // 사전 조회 이후 published로 변경된 경우 삭제하지 않는다.
    .neq("lifecycle_status", "published")
    .select("id")
    .maybeSingle();

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_DELETE_FAILED,
      message: "관리자 AI prompt version 삭제에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_PROMPT_VERSION,
    });

    return {
      message: "Prompt Version을 삭제하지 못했습니다.",
      ok: false,
    };
  }

  // 사전 조회 이후 lifecycle 상태가 published로 변경된 경우 0건 삭제될 수 있다.
  if (!data) {
    return {
      message: "published version은 삭제할 수 없습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}
