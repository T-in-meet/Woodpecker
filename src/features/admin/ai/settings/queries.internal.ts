import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.types";

import { AdminAiSetting } from "./types";

type AdminAiSettingRow = Database["public"]["Tables"]["ai_settings"]["Row"];

/**
 * AI 설정 DB row를 관리자 화면에서 사용하는 형태로 변환합니다.
 *
 * @param row AI 설정 DB row
 * @returns 관리자 AI 설정
 */
function mapAdminAiSetting(row: AdminAiSettingRow): AdminAiSetting {
  return {
    createdAt: row.created_at,
    description: row.description,
    displayName: row.display_name,
    id: row.id,
    key: row.key,
    updatedAt: row.updated_at,
  };
}

/**
 * AI 설정 Key로 설정을 조회합니다.
 *
 * 인증 여부를 확인하지 않는 내부 조회 함수이므로,
 * 호출하는 public query 또는 action에서 관리자 인증을 먼저 확인해야 합니다.
 *
 * @param key 조회할 AI 설정 Key
 * @returns 일치하는 AI 설정 또는 null
 */
export async function getAdminAiSettingByKeyInternal(key: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_settings")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load admin AI setting by key: ${error.message}`);
  }

  return data ? mapAdminAiSetting(data) : null;
}

/**
 * 관리자 AI 설정 상세를 조회합니다.
 *
 * 인증 여부를 확인하지 않는 내부 조회 함수이므로,
 * 호출하는 public query 또는 action에서 관리자 인증을 먼저 확인해야 합니다.
 *
 * @param settingId 조회할 ai_settings.id
 * @returns AI 설정 상세 또는 null
 */
export async function getAdminAiSettingDetailInternal(settingId: string) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_settings")
    .select("*")
    .eq("id", settingId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load admin AI setting detail: ${error.message}`);
  }

  return data ? mapAdminAiSetting(data) : null;
}

/**
 * AI 설정에 연결된 구성을 조회합니다.
 *
 * @param settingId 조회할 AI 설정 ID
 * @returns AI 설정 구성 목록
 */
export async function getAdminAiSettingConfigurationsInternal(
  settingId: string,
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_setting_configurations")
    .select(
      "id,role_key,kind,model_config_id,prompt_version_id,temperature,sort_order",
    )
    .eq("setting_id", settingId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to load AI setting configurations: ${error.message}`,
    );
  }

  return data;
}
