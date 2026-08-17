"use server";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { AI_PROMPT_LIFECYCLE_STATUS } from "../constants/prompts";
import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import {
  aiPromptAgentRowSchema,
  aiPromptFamilyRowSchema,
  aiPromptVersionRowSchema,
} from "./schema";
import type { AiPromptAgent, AiPromptFamily, AiPromptVersion } from "./types";

/** AI prompt 조회에 필요한 Supabase Client 최소 형태입니다. */
type AiPromptClient = Pick<ReturnType<typeof createAdminClient>, "from">;

/**
 * 지정한 Agent와 Published Prompt Version을 ID로 조회합니다.
 */
export async function getPublishedAiPromptVersionForAgent(params: {
  agentId: string;
  promptVersionId: string;
  supabase?: AiPromptClient | undefined;
}): Promise<{
  agent: AiPromptAgent;
  family: AiPromptFamily;
  version: AiPromptVersion;
}> {
  const supabase = params.supabase ?? createAdminClient();

  const { data: agentRow, error: agentError } = await supabase
    .from("ai_prompt_agents")
    .select("id,display_name,description,purpose,tags,created_at,updated_at")
    .eq("id", params.agentId)
    .maybeSingle();

  if (agentError) {
    await reportAiOperationalError({
      error: agentError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROMPT_AGENT_LOAD_FAILED,
      message: "AI prompt agent 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_AGENT,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        agentId: params.agentId,
      },
    });

    throw new Error(`Failed to load AI prompt agent: ${agentError.message}`);
  }

  if (!agentRow) {
    throw new Error(`AI prompt agent not found: ${params.agentId}`);
  }

  const agent = aiPromptAgentRowSchema.parse(agentRow);

  const { data: versionRow, error: versionError } = await supabase
    .from("ai_prompt_versions")
    .select(
      "id,family_id,version_number,display_name,change_summary,lifecycle_status,system_template,user_template,response_schema,variables,tags,created_by_kind,created_by,created_at",
    )
    .eq("id", params.promptVersionId)
    .eq("lifecycle_status", AI_PROMPT_LIFECYCLE_STATUS.PUBLISHED)
    .maybeSingle();

  if (versionError) {
    await reportAiOperationalError({
      error: versionError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROMPT_VERSION_LOAD_FAILED,
      message: "AI prompt version 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_VERSION,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        agentId: params.agentId,
        promptVersionId: params.promptVersionId,
      },
    });

    throw new Error(
      `Failed to load published AI prompt version: ${versionError.message}`,
    );
  }

  if (!versionRow) {
    throw new Error(
      `Published AI prompt version not found: ${params.promptVersionId}`,
    );
  }

  const version = aiPromptVersionRowSchema.parse(versionRow);

  const { data: familyRow, error: familyError } = await supabase
    .from("ai_prompt_families")
    .select("id,agent_id,display_name,description,tags,created_at,updated_at")
    .eq("id", version.family_id)
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (familyError) {
    await reportAiOperationalError({
      error: familyError,
      errorCode: AI_OPERATIONAL_ERROR_CODE.PROMPT_FAMILY_LOAD_FAILED,
      message: "AI prompt family 조회에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.GET_PROMPT_FAMILY,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      context: {
        agentId: agent.id,
        promptFamilyId: version.family_id,
      },
    });

    throw new Error(`Failed to load AI prompt family: ${familyError.message}`);
  }

  if (!familyRow) {
    throw new Error(
      `AI prompt version does not belong to agent: ${params.promptVersionId}`,
    );
  }

  const family = aiPromptFamilyRowSchema.parse(familyRow);

  return {
    agent,
    family,
    version,
  };
}
