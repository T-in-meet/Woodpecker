import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_AI_AGENTS_QUERY_KEY } from "../agents/constants/query-keys";
import { ADMIN_AI_MODELS_QUERY_KEY } from "../models/constants/query-keys";
import { ADMIN_AI_PROMPTS_QUERY_KEY } from "../prompts/constants/query-keys";
import { invalidateAdminAiQueries } from "../utils/invalidate-admin-ai-queries";

describe("invalidateAdminAiQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Admin AI 모델, Agent, Prompt Query 캐시를 무효화한다", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    const queryClient = {
      invalidateQueries,
    };

    await invalidateAdminAiQueries(queryClient as never);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_MODELS_QUERY_KEY.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_AGENTS_QUERY_KEY.all,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.all,
    });
  });

  it("Query invalidation이 완료될 때까지 기다린다", async () => {
    let resolveModels: (() => void) | undefined;
    let resolveAgents: (() => void) | undefined;
    let resolvePrompts: (() => void) | undefined;

    const promises = [
      new Promise<void>((resolve) => {
        resolveModels = resolve;
      }),
      new Promise<void>((resolve) => {
        resolveAgents = resolve;
      }),
      new Promise<void>((resolve) => {
        resolvePrompts = resolve;
      }),
    ];

    const invalidateQueries = vi
      .fn()
      .mockImplementationOnce(() => promises[0])
      .mockImplementationOnce(() => promises[1])
      .mockImplementationOnce(() => promises[2]);

    const queryClient = {
      invalidateQueries,
    };

    let completed = false;

    const invalidation = invalidateAdminAiQueries(queryClient as never).then(
      () => {
        completed = true;
      },
    );

    await Promise.resolve();

    expect(completed).toBe(false);

    resolveModels?.();

    await Promise.resolve();

    expect(completed).toBe(false);

    resolveAgents?.();

    await Promise.resolve();

    expect(completed).toBe(false);

    resolvePrompts?.();

    await invalidation;

    expect(completed).toBe(true);
  });
});
