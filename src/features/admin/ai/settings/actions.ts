"use server";

import { revalidatePath } from "next/cache";

import {
  ADMIN_AI_OPERATIONAL_ERROR_CODE,
  ADMIN_AI_OPERATIONAL_ERROR_OPERATION,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../utils/require-admin";
import { reportAdminAiActionError } from "../utils/report-admin-ai-action-error";
import { getAdminAiSettingByKeyInternal } from "./queries.internal";
import {
  AdminAiSettingConfigurationsSaveInput,
  adminAiSettingConfigurationsSaveInputSchema,
  adminAiSettingCreateInputSchema,
  AdminAiSettingDeleteInput,
  adminAiSettingDeleteInputSchema,
  AdminAiSettingUpdateInput,
  adminAiSettingUpdateInputSchema,
} from "./schema";

/**
 * @description 관리자 AI 설정 생성 결과입니다.
 */
export type CreateAdminAiSettingActionResult =
  | {
      success: true;
      settingId: string;
    }
  | {
      success: false;
      message: string;
    };

/**
 * 관리자 AI 설정을 생성합니다.
 *
 * @param input AI 설정 생성 입력값
 * @returns AI 설정 생성 결과
 */
export async function createAdminAiSettingAction(
  input: unknown,
): Promise<CreateAdminAiSettingActionResult> {
  const adminUserId = await requireAdmin();

  const parsed = adminAiSettingCreateInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "입력값을 확인해주세요.",
    };
  }

  let existingSetting: Awaited<
    ReturnType<typeof getAdminAiSettingByKeyInternal>
  >;

  try {
    existingSetting = await getAdminAiSettingByKeyInternal(parsed.data.key);
  } catch (error) {
    await reportAdminAiActionError({
      adminUserId,
      context: {
        settingKey: parsed.data.key,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_LOAD_FAILED,
      message: "관리자 AI 설정 중복 조회에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_SETTING,
    });

    return {
      success: false,
      message: "AI 설정 생성에 실패했습니다.",
    };
  }

  if (existingSetting) {
    return {
      success: false,
      message: "이미 사용 중인 설정 키입니다.",
    };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_settings")
    .insert({
      description: parsed.data.description,
      display_name: parsed.data.displayName,
      key: parsed.data.key,
    })
    .select("id")
    .single();

  if (error) {
    /**
     * 사전 중복 조회 이후 동시에 동일한 Key가 생성되는 경우에도
     * DB Unique 제약을 최종 안전장치로 사용합니다.
     */
    if (error.code === "23505") {
      return {
        success: false,
        message: "이미 사용 중인 설정 키입니다.",
      };
    }

    await reportAdminAiActionError({
      adminUserId,
      context: {
        settingKey: parsed.data.key,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CREATE_FAILED,
      message: "관리자 AI 설정 생성에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_SETTING,
    });

    return {
      success: false,
      message: "AI 설정 생성에 실패했습니다.",
    };
  }

  revalidatePath(ROUTES.ADMIN.AI.SETTINGS);

  return {
    success: true,
    settingId: data.id,
  };
}

/**
 * @description 관리자 AI 설정 수정 결과입니다.
 */
export type UpdateAdminAiSettingActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

/**
 * 관리자 AI 설정 기본 정보를 수정합니다.
 *
 * @param input AI 설정 수정 입력값
 * @returns AI 설정 수정 결과
 */
export async function updateAdminAiSettingAction(
  input: AdminAiSettingUpdateInput,
): Promise<UpdateAdminAiSettingActionResult> {
  const adminUserId = await requireAdmin();

  const parsed = adminAiSettingUpdateInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "입력값을 확인해주세요.",
    };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("ai_settings")
    .update({
      description: parsed.data.description,
      display_name: parsed.data.displayName,
    })
    .eq("id", parsed.data.settingId);

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      context: {
        settingId: parsed.data.settingId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_UPDATE_FAILED,
      message: "관리자 AI 설정 수정에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_SETTING,
    });

    return {
      success: false,
      message: "AI 설정 수정에 실패했습니다.",
    };
  }

  return {
    success: true,
  };
}

export type DeleteAdminAiSettingActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

/**
 * 관리자 AI 설정을 삭제합니다.
 *
 * 연결된 AI 구성은 DB의 ON DELETE CASCADE에 의해 함께 삭제됩니다.
 *
 * @param input AI 설정 삭제 입력값
 * @returns AI 설정 삭제 결과
 */
export async function deleteAdminAiSettingAction(
  input: AdminAiSettingDeleteInput,
): Promise<DeleteAdminAiSettingActionResult> {
  const adminUserId = await requireAdmin();

  const parsed = adminAiSettingDeleteInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "입력값을 확인해주세요.",
    };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("ai_settings")
    .delete()
    .eq("id", parsed.data.settingId);

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      context: {
        settingId: parsed.data.settingId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_DELETE_FAILED,
      message: "관리자 AI 설정 삭제에 실패했습니다.",
      operation: ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_SETTING,
    });

    return {
      success: false,
      message: "AI 설정 삭제에 실패했습니다.",
    };
  }

  return {
    success: true,
  };
}

export type SaveAdminAiSettingConfigurationsActionResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

/**
 * 관리자 AI 설정의 Configuration 전체 상태를 저장합니다.
 *
 * @param input AI 설정 구성 전체 저장 입력값
 * @returns AI 설정 구성 저장 결과
 */
export async function saveAdminAiSettingConfigurationsAction(
  input: AdminAiSettingConfigurationsSaveInput,
): Promise<SaveAdminAiSettingConfigurationsActionResult> {
  const adminUserId = await requireAdmin();

  const parsed = adminAiSettingConfigurationsSaveInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "입력값을 확인해주세요.",
    };
  }

  const supabase = createAdminClient();

  const { error } = await supabase.rpc("save_ai_setting_configurations", {
    p_setting_id: parsed.data.settingId,
    p_configurations: parsed.data.configurations,
  });

  if (error) {
    await reportAdminAiActionError({
      adminUserId,
      context: {
        configurationCount: parsed.data.configurations.length,
        settingId: parsed.data.settingId,
      },
      error,
      errorCode: ADMIN_AI_OPERATIONAL_ERROR_CODE.SETTING_CONFIG_SAVE_FAILED,
      message: "관리자 AI 구성 저장에 실패했습니다.",
      operation:
        ADMIN_AI_OPERATIONAL_ERROR_OPERATION.SAVE_SETTING_CONFIGURATIONS,
    });

    return {
      success: false,
      message: "AI 구성 저장에 실패했습니다.",
    };
  }

  return {
    success: true,
  };
}
