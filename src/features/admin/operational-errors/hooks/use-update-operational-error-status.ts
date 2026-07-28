"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { OperationalErrorStatusType } from "@/features/operational-errors/constants";
import { showToast } from "@/lib/utils/showToast";

import { updateOperationalErrorStatus } from "../actions";
import { ADMIN_OPERATIONAL_ERROR_DETAIL_QUERY_KEY } from "./use-operational-error-detail";
import { ADMIN_OPERATIONAL_ERRORS_QUERY_KEY } from "./use-operational-errors";

interface UpdateOperationalErrorStatusVariables {
  /** 상태를 변경할 운영 오류 ID */
  operationalErrorId: string;

  /** 새로 적용할 운영 오류 상태 */
  status: OperationalErrorStatusType;

  /** 이번 상태 변경에 함께 기록할 처리 메모 */
  resolutionNote: string;
}

/**
 * 운영 오류 상태를 변경하고 관련 목록 및 상세 캐시를 갱신합니다.
 *
 * Server Action 실행 결과가 실패인 경우 오류 메시지를 표시하고,
 * 성공한 경우 운영 오류 상세 및 목록 Query를 무효화합니다.
 */
export function useUpdateOperationalErrorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      operationalErrorId,
      status,
      resolutionNote,
    }: UpdateOperationalErrorStatusVariables) =>
      updateOperationalErrorStatus(operationalErrorId, status, resolutionNote),

    onSuccess: async (result, variables) => {
      if (!result.ok) {
        showToast(result.message, {
          variant: "destructive",
        });

        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ADMIN_OPERATIONAL_ERROR_DETAIL_QUERY_KEY.detail(
            variables.operationalErrorId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ADMIN_OPERATIONAL_ERRORS_QUERY_KEY.all,
        }),
      ]);

      showToast("운영 오류 상태가 저장되었습니다.");
    },

    onError: () => {
      showToast("운영 오류 상태를 저장하지 못했습니다.", {
        variant: "destructive",
      });
    },
  });
}
