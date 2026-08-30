"use client";

import { useQuery } from "@tanstack/react-query";

import { noteChatQueryKeys } from "../constants/query-keys";
import { getNoteChatDailyUsage } from "../queries";

/**
 * 현재 사용자의 Note Chat 일일 AI 실행 사용량 Query입니다.
 *
 * 일반 사용자는 KST 기준 오늘 사용량과 일일 실행 제한을 조회하고,
 * quota를 우회하는 ADMIN이나 사용량을 확인할 수 없는 경우에는 null을 반환합니다.
 */
export function useNoteChatDailyUsageQuery() {
  return useQuery({
    queryKey: noteChatQueryKeys.dailyUsage(),
    queryFn: getNoteChatDailyUsage,
  });
}
