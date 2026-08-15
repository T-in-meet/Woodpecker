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
  archiveAdminAiPromptVersion: vi.fn(),
  createAdminAiPromptVersion: vi.fn(),
  deleteAdminAiPromptVersion: vi.fn(),
  publishAdminAiPromptVersion: vi.fn(),
  updateAdminAiPromptVersion: vi.fn(),
}));

import {
  useArchiveAdminAiPromptVersion,
  useCreateAdminAiPromptVersion,
  useDeleteAdminAiPromptVersion,
  usePublishAdminAiPromptVersion,
  useUpdateAdminAiPromptVersion,
} from "../hooks/use-admin-ai-prompt-version-mutations";

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

describe("use-admin-ai-prompt-version-mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Prompt Version 생성 결과를 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      id: "55555555-5555-4555-8555-555555555555",
      ok: true,
    } satisfies AdminAiActionResult;

    useCreateAdminAiPromptVersion();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });

  it("Prompt Version 수정 실패 결과를 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      message: "Prompt Version 상태가 변경되었습니다. 다시 시도해주세요.",
      ok: false,
    } satisfies AdminAiActionResult;

    useUpdateAdminAiPromptVersion();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });

  it("Prompt Version publish 실패 결과를 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      message: "draft 또는 archived version만 publish할 수 있습니다.",
      ok: false,
    } satisfies AdminAiActionResult;

    usePublishAdminAiPromptVersion();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });

  it("Prompt Version archive 실패 결과를 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      message: "published version만 archive할 수 있습니다.",
      ok: false,
    } satisfies AdminAiActionResult;

    useArchiveAdminAiPromptVersion();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });

  it("Prompt Version 삭제 실패 결과를 성공 조건부 invalidation 유틸에 전달한다", () => {
    const queryClient = useQueryClient();
    const result = {
      message: "published version은 삭제할 수 없습니다.",
      ok: false,
    } satisfies AdminAiActionResult;

    useDeleteAdminAiPromptVersion();

    getLatestUseMutationOptions().onSuccess(result);

    expect(invalidateAdminAiQueriesOnSuccessfulResultMock).toHaveBeenCalledWith(
      queryClient,
      result,
    );
  });
});
