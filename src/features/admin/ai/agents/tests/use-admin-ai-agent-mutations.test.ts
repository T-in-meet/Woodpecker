import { useMutation, useQueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiActionResult } from "../../types";

const { invalidateAdminAiQueriesMock } = vi.hoisted(() => ({
  invalidateAdminAiQueriesMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn((options: AdminAiAgentMutationOptions) => options),
  useQueryClient: vi.fn(() => ({
    queryClientId: "admin-ai-query-client",
  })),
}));

vi.mock("../../utils/invalidate-admin-ai-queries", () => ({
  invalidateAdminAiQueries: invalidateAdminAiQueriesMock,
}));

vi.mock("../actions", () => ({
  createAdminAiAgent: vi.fn(),
  deleteAdminAiAgent: vi.fn(),
  updateAdminAiAgent: vi.fn(),
}));

import {
  useCreateAdminAiAgent,
  useDeleteAdminAiAgent,
  useUpdateAdminAiAgent,
} from "../hooks/use-admin-ai-agent-mutations";

/** 테스트에서 검증하는 Agent mutation 옵션의 최소 구조입니다. */
type AdminAiAgentMutationOptions = {
  mutationFn: unknown;
  onSuccess: (result: AdminAiActionResult) => unknown;
};

/** 가장 최근 useMutation 호출 옵션을 반환합니다. */
function getLatestUseMutationOptions() {
  const calls = vi.mocked(useMutation).mock.calls;
  const latestCall = calls.at(-1);

  if (!latestCall) {
    throw new Error("useMutation was not called.");
  }

  return latestCall[0] as AdminAiAgentMutationOptions;
}

describe("use-admin-ai-agent-mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Agent 생성이 실패 응답으로 resolve되면 Query 캐시를 무효화하지 않는다", () => {
    useCreateAdminAiAgent();

    const options = getLatestUseMutationOptions();

    options.onSuccess({
      message: "입력 오류",
      ok: false,
    });

    expect(invalidateAdminAiQueriesMock).not.toHaveBeenCalled();
  });

  it("Agent 수정이 성공 응답으로 resolve되면 Query 캐시를 무효화한다", () => {
    const queryClient = useQueryClient();

    useUpdateAdminAiAgent();

    const options = getLatestUseMutationOptions();

    options.onSuccess({
      ok: true,
    });

    expect(invalidateAdminAiQueriesMock).toHaveBeenCalledWith(queryClient);
  });

  it("Agent 삭제가 실패 응답으로 resolve되면 Query 캐시를 무효화하지 않는다", () => {
    useDeleteAdminAiAgent();

    const options = getLatestUseMutationOptions();

    options.onSuccess({
      message: "Agent를 찾을 수 없습니다.",
      ok: false,
    });

    expect(invalidateAdminAiQueriesMock).not.toHaveBeenCalled();
  });
});
