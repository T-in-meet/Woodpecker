"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import {
  createAdminAiSettingAction,
  deleteAdminAiSettingAction,
  updateAdminAiSettingAction,
} from "../actions";

/**
 * 관리자 AI 설정 생성 Mutation입니다.
 *
 * 생성 성공 시 관리자 AI 관련 Query를 무효화합니다.
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

      await invalidateAdminAiQueries(queryClient);
    },
  });
}

/**
 * 관리자 AI 설정 수정 Mutation입니다.
 *
 * 수정 성공 시 관리자 AI 관련 Query를 무효화합니다.
 *
 * @returns AI 설정 수정 Mutation
 */
export function useUpdateAdminAiSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAiSettingAction,
    onSuccess: async (result) => {
      if (!result.success) {
        return;
      }

      await invalidateAdminAiQueries(queryClient);
    },
  });
}

/**
 * 관리자 AI 설정 삭제 Mutation입니다.
 *
 * 삭제 성공 시 관리자 AI 관련 Query를 무효화합니다.
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

      await invalidateAdminAiQueries(queryClient);
    },
  });
}
