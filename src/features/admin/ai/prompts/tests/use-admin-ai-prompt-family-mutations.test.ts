import { useMutation, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiActionResult } from "../../types";

const { invalidateAdminAiQueriesOnSuccessfulResultMock } = vi.hoisted(() => ({
  invalidateAdminAiQueriesOnSuccessfulResultMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((options: AdminAiPromptMutationOptions) => options),
  useQueryClient: vi.fn(() => ({
    queryClientId: "admin-ai-query-client",
  })),
}));

vi.mock("../../utils/invalidate-admin-ai-queries-on-successful-result", () => ({
  invalidateAdminAiQueriesOnSuccessfulResult:
    invalidateAdminAiQueriesOnSuccessfulResultMock,
}));

vi.mock("../actions", () => ({
  createAdminAiPromptFamily: vi.fn(),
  deleteAdminAiPromptFamily: vi.fn(),
  updateAdminAiPromptFamily: vi.fn(),
}));

import {
  useCreateAdminAiPromptFamily,
  useDeleteAdminAiPromptFamily,
  useUpdateAdminAiPromptFamily,
} from "../hooks/use-admin-ai-prompt-family-mutations";

/** 테스트에서 검증하는 Prompt mutation 옵션의 최소 구조입니다. */
type AdminAiPromptMutationOptions = {
  mutationFn: unknown;
  onSuccess: (result: AdminAiActionResult) => unknown;
};

/**
 * 가장 최근 useMutation 호출 옵션을 반환합니다.
 *
 * @returns React Query mutation 호출 옵션
 */
function getLatestUseMutationOptions() {
  const calls = vi.mocked(useMutation).mock.calls;
  const latestCall = calls.at(-1);

  if (!latestCall) {
    throw new Error("useMutation was not called.");
  }

  return latestCall[0] as AdminAiPromptMutationOptions;
}

describe("use-admin-ai-prompt-family-mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Prompt Family 생성 결과를 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      id: "44444444-4444-4444-8444-444444444444",
      ok: true,
    } satisfies AdminAiActionResult;

    useCreateAdminAiPromptFamily();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });

  it("Prompt Family 수정 실패 결과도 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      message: "Prompt Family를 수정하지 못했습니다.",
      ok: false,
    } satisfies AdminAiActionResult;

    useUpdateAdminAiPromptFamily();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });

  it("Prompt Family 삭제 실패 결과도 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      message: "Prompt family를 찾을 수 없습니다.",
      ok: false,
    } satisfies AdminAiActionResult;

    useDeleteAdminAiPromptFamily();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });
});
