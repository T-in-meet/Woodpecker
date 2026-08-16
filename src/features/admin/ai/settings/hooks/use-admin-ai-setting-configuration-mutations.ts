"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import { saveAdminAiSettingConfigurationsAction } from "../actions";

/**
 * 관리자 AI 설정의 Configuration 전체 상태를 저장합니다.
 */
export function useSaveAdminAiSettingConfigurations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveAdminAiSettingConfigurationsAction,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      await invalidateAdminAiQueries(queryClient);
    },
  });
}
