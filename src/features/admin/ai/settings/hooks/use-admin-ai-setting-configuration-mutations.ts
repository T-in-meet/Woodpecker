"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveAdminAiSettingConfigurationsAction } from "../actions";
import {
  ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY,
  ADMIN_AI_SETTINGS_QUERY_KEY,
} from "../constants/query-keys";

/**
 * 관리자 AI 설정의 Configuration 전체 상태를 저장합니다.
 */
export function useSaveAdminAiSettingConfigurations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveAdminAiSettingConfigurationsAction,
    onSuccess: async (result, variables) => {
      if (!result.success) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY.bySetting(
          variables.settingId,
        ),
      });
      await queryClient.invalidateQueries({
        queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.all,
      });
    },
  });
}
