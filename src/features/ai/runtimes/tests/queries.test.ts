import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportAiOperationalError } from "../../utils/report-ai-operational-error";
import { getAiRuntimeConfigurationRow } from "../queries";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("../../utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
  markAiOperationalErrorAsReported: (error: unknown) => error,
}));

type MaybeSingleResult = {
  data: unknown;
  error: { message: string } | null;
};

function createSupabaseMock(result: MaybeSingleResult) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();

  const query = {
    eq,
    maybeSingle,
    select,
  };

  eq.mockReturnValue(query);
  select.mockReturnValue(query);
  from.mockReturnValue(query);

  return {
    client: {
      from,
    },
    eq,
    from,
    maybeSingle,
    select,
  };
}

describe("getAiRuntimeConfigurationRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("featureKey와 roleKey에 해당하는 Runtime Configuration을 반환한다", async () => {
    const row = {
      id: "configuration-id",
      kind: "chat",
      role_key: "answer-generation",
      model_config_id: "chat-model-id",
      prompt_version_id: "prompt-version-id",
      temperature: 0.2,
      ai_settings: {
        id: "setting-id",
        key: "note-chat",
      },
      ai_prompt_versions: {
        id: "prompt-version-id",
        family_id: "prompt-family-id",
        ai_prompt_families: {
          id: "prompt-family-id",
          agent_id: "agent-id",
        },
      },
    };

    const supabase = createSupabaseMock({
      data: row,
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createAdminClient>,
    );

    const result = await getAiRuntimeConfigurationRow(
      "note-chat",
      "answer-generation",
    );

    expect(result).toEqual(row);

    expect(supabase.from).toHaveBeenCalledWith("ai_setting_configurations");

    expect(supabase.eq).toHaveBeenNthCalledWith(
      1,
      "ai_settings.key",
      "note-chat",
    );

    expect(supabase.eq).toHaveBeenNthCalledWith(
      2,
      "role_key",
      "answer-generation",
    );

    expect(supabase.maybeSingle).toHaveBeenCalledOnce();
  });

  it("DB 조회가 실패하면 운영 오류를 기록하고 조회 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: {
        message: "database error",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createAdminClient>,
    );

    await expect(
      getAiRuntimeConfigurationRow("note-chat", "answer-generation"),
    ).rejects.toThrow(
      "Failed to load AI runtime configuration: database error",
    );

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: "database error",
        }),
        errorCode: AI_OPERATIONAL_ERROR_CODE.RUNTIME_CONFIGURATION_LOAD_FAILED,
        operation: AI_OPERATIONAL_ERROR_OPERATION.GET_RUNTIME_CONFIGURATION,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      }),
    );
  });

  it("해당 featureKey와 roleKey의 구성이 없으면 not found 오류를 발생시킨다", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createAdminClient>,
    );

    await expect(
      getAiRuntimeConfigurationRow("note-chat", "answer-generation"),
    ).rejects.toThrow(
      "AI runtime configuration not found: note-chat/answer-generation",
    );
  });
});
