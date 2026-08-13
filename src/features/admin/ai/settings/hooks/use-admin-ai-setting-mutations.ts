"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createAdminAiSettingAction,
  deleteAdminAiSettingAction,
  updateAdminAiSettingAction,
} from "../actions";
import { ADMIN_AI_SETTINGS_QUERY_KEY } from "../constants/query-keys";

/**
 * 관리자 AI 설정 생성 Mutation입니다.
 *
 * 생성 성공 시 AI 설정 관련 Query를 무효화합니다.
 *
 * @returns AI 설정 생성 Mutation
 */
export function useCreateAdminAiSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAiSettingAction,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.all,
      });
    },
  });
}

/**
 * 관리자 AI 설정 수정 Mutation입니다.
 *
 * 수정 성공 시 해당 설정 상세 Query를 무효화합니다.
 *
 * @returns AI 설정 수정 Mutation
 */
export function useUpdateAdminAiSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAiSettingAction,
    onSuccess: async (result, variables) => {
      if (!result.success) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.detail(variables.settingId),
      });
      await queryClient.invalidateQueries({
        queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.all,
      });
    },
  });
}

/**
 * 관리자 AI 설정 삭제 Mutation입니다.
 *
 * 삭제 성공 시 AI 설정 Query를 무효화합니다.
 *
 * @returns AI 설정 삭제 Mutation
 */
export function useDeleteAdminAiSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminAiSettingAction,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.all,
      });
    },
  });
}
