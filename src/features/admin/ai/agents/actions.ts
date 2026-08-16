"use server";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../utils/require-admin";
import { uuidSchema } from "../schema";
import { AdminAiActionResult } from "../types";
import { readFormString } from "../utils/form-data";
import { reportAdminAiActionError } from "../utils/report-admin-ai-action-error";
import { revalidateAdminAiPaths } from "../utils/revalidate";
import {
  adminAiAgentDeleteRpcResultSchema,
  createAgentSchema,
  updateAgentSchema,
} from "./schema";

/**
 * AI Agent를 생성합니다.
 *
 * Prompt Family와 Version은 Prompt 관리 기능에서 별도로 생성합니다.
 *
 * @param formData Agent 생성 입력
 * @returns mutation 결과
 */
export async function createAdminAiAgent(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = createAgentSchema.safeParse({
    description: readFormString(formData, "description"),
    displayName: readFormString(formData, "displayName"),
    purpose: readFormString(formData, "purpose"),
    tags: readFormString(formData, "tags"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_prompt_agents")
    .insert({
      description: parsedInput.data.description,
      display_name: parsedInput.data.displayName,
      purpose: parsedInput.data.purpose,
      tags: parsedInput.data.tags,
    })
    .select("id")
    .single();

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_CREATE_FAILED,
      message: "관리자 AI agent 생성에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_PROMPT_AGENT,
    });

    return { message: error.message, ok: false };
  }

  revalidateAdminAiPaths();

  return { id: data.id, ok: true };
}

/**
 * AI agent 운영 필드를 수정합니다.
 *
 * @param formData agent 수정 입력
 * @returns mutation 결과
 */
export async function updateAdminAiAgent(
  formData: FormData,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedInput = updateAgentSchema.safeParse({
    agentId: readFormString(formData, "agentId"),
    description: readFormString(formData, "description"),
    displayName: readFormString(formData, "displayName"),
    purpose: readFormString(formData, "purpose"),
    tags: readFormString(formData, "tags"),
  });

  if (!parsedInput.success) {
    return {
      message: parsedInput.error.issues[0]?.message ?? "입력 오류",
      ok: false,
    };
  }

  const supabase = createAdminClient();
  /*
   * update만 호출하면 조건에 맞는 Agent가 없어도 오류가 반환되지 않을 수 있다.
   * 수정된 row를 함께 조회해 존재하지 않는 Agent 수정을 성공으로 처리하지 않는다.
   */
  const { data: updatedAgent, error } = await supabase
    .from("ai_prompt_agents")
    .update({
      description: parsedInput.data.description,
      display_name: parsedInput.data.displayName,
      purpose: parsedInput.data.purpose,
      tags: parsedInput.data.tags,
    })
    .eq("id", parsedInput.data.agentId)
    .select("id")
    .maybeSingle();

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_UPDATE_FAILED,
      message: "관리자 AI agent 수정에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_PROMPT_AGENT,
    });

    return { message: error.message, ok: false };
  }

  if (!updatedAgent) {
    return { message: "수정할 AI Agent를 찾을 수 없습니다.", ok: false };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}

/**
 * AI agent를 제한 조건 안에서 삭제합니다.
 *
 * @param agentId 삭제할 agent ID
 * @returns mutation 결과
 */
export async function deleteAdminAiAgent(
  agentId: string,
): Promise<AdminAiActionResult> {
  const adminUserId = await requireAdmin();
  const parsedId = uuidSchema.safeParse(agentId);

  if (!parsedId.success) {
    return { message: "Agent ID가 올바르지 않습니다.", ok: false };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("delete_admin_ai_agent", {
    p_agent_id: parsedId.data,
  });

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_DELETE_FAILED,
      message: "관리자 AI agent 삭제에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_PROMPT_AGENT,
    });

    return { message: error.message, ok: false };
  }

  const parsedResult = adminAiAgentDeleteRpcResultSchema.safeParse(data);

  if (!parsedResult.success) {
    await reportAdminAiActionError({
      adminUserId,
      error: parsedResult.error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.AGENT_DELETE_FAILED,
      message: "관리자 AI agent 삭제 RPC 응답 검증에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_PROMPT_AGENT,
    });

    return { message: "Agent 삭제 요청을 처리하지 못했습니다.", ok: false };
  }

  if (parsedResult.data === "NOT_FOUND") {
    return { message: "Agent를 찾을 수 없습니다.", ok: false };
  }

  if (parsedResult.data === "NOT_DELETABLE") {
    return {
      message:
        "AI Settings에서 사용 중인 Prompt Version이 있어 Agent를 삭제할 수 없습니다.",
      ok: false,
    };
  }

  revalidateAdminAiPaths();

  return { ok: true };
}
