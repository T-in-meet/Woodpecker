import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getAdminAiSettingByKeyInternal,
  getAdminAiSettingConfigurationsInternal,
  getAdminAiSettingDetailInternal,
} from "../queries.internal";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

describe("queries.internal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAdminAiSettingByKeyInternal", () => {
    it("AI 설정 key로 설정을 조회하고 화면 타입으로 변환한다", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          key: "note-chat",
          display_name: "노트 챗봇",
          description: "노트 챗봇 설정",
          created_at: "2026-08-07T00:00:00.000Z",
          updated_at: "2026-08-07T01:00:00.000Z",
        },
        error: null,
      });

      const eq = vi.fn().mockReturnValue({
        maybeSingle,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await getAdminAiSettingByKeyInternal("note-chat");

      expect(from).toHaveBeenCalledWith("ai_settings");
      expect(select).toHaveBeenCalledWith("*");
      expect(eq).toHaveBeenCalledWith("key", "note-chat");
      expect(maybeSingle).toHaveBeenCalled();

      expect(result).toEqual({
        id: "11111111-1111-4111-8111-111111111111",
        key: "note-chat",
        displayName: "노트 챗봇",
        description: "노트 챗봇 설정",
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T01:00:00.000Z",
      });
    });

    it("일치하는 AI 설정이 없으면 null을 반환한다", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const eq = vi.fn().mockReturnValue({
        maybeSingle,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      await expect(
        getAdminAiSettingByKeyInternal("missing-setting"),
      ).resolves.toBeNull();
    });

    it("AI 설정 key 조회에 실패하면 예외를 던진다", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "database error",
        },
      });

      const eq = vi.fn().mockReturnValue({
        maybeSingle,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      await expect(getAdminAiSettingByKeyInternal("note-chat")).rejects.toThrow(
        "Failed to load admin AI setting by key: database error",
      );
    });
  });

  describe("getAdminAiSettingDetailInternal", () => {
    it("AI 설정 ID로 상세를 조회하고 화면 타입으로 변환한다", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: {
          id: "11111111-1111-4111-8111-111111111111",
          key: "note-chat",
          display_name: "노트 챗봇",
          description: "노트 챗봇 설정",
          created_at: "2026-08-07T00:00:00.000Z",
          updated_at: "2026-08-07T01:00:00.000Z",
        },
        error: null,
      });

      const eq = vi.fn().mockReturnValue({
        maybeSingle,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await getAdminAiSettingDetailInternal(
        "11111111-1111-4111-8111-111111111111",
      );

      expect(eq).toHaveBeenCalledWith(
        "id",
        "11111111-1111-4111-8111-111111111111",
      );

      expect(result).toEqual({
        id: "11111111-1111-4111-8111-111111111111",
        key: "note-chat",
        displayName: "노트 챗봇",
        description: "노트 챗봇 설정",
        createdAt: "2026-08-07T00:00:00.000Z",
        updatedAt: "2026-08-07T01:00:00.000Z",
      });
    });

    it("일치하는 상세가 없으면 null을 반환한다", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const eq = vi.fn().mockReturnValue({
        maybeSingle,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      await expect(
        getAdminAiSettingDetailInternal("11111111-1111-4111-8111-111111111111"),
      ).resolves.toBeNull();
    });

    it("AI 설정 상세 조회에 실패하면 예외를 던진다", async () => {
      const maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "database error",
        },
      });

      const eq = vi.fn().mockReturnValue({
        maybeSingle,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      await expect(
        getAdminAiSettingDetailInternal("11111111-1111-4111-8111-111111111111"),
      ).rejects.toThrow(
        "Failed to load admin AI setting detail: database error",
      );
    });
  });

  describe("getAdminAiSettingConfigurationsInternal", () => {
    it("AI 설정 구성을 sort_order 오름차순으로 조회한다", async () => {
      const rows = [
        {
          id: "22222222-2222-4222-8222-222222222222",
          kind: "chat",
          model_config_id: "33333333-3333-4333-8333-333333333333",
          prompt_version_id: "44444444-4444-4444-8444-444444444444",
          role_key: "primary-chat",
          temperature: 0.2,
          sort_order: 0,
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          kind: "embedding",
          model_config_id: "66666666-6666-4666-8666-666666666666",
          prompt_version_id: null,
          role_key: "primary-embedding",
          temperature: null,
          sort_order: 1,
        },
      ];

      const order = vi.fn().mockResolvedValue({
        data: rows,
        error: null,
      });

      const eq = vi.fn().mockReturnValue({
        order,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      const result = await getAdminAiSettingConfigurationsInternal(
        "11111111-1111-4111-8111-111111111111",
      );

      expect(from).toHaveBeenCalledWith("ai_setting_configurations");
      expect(select).toHaveBeenCalledWith(
        "id,role_key,kind,model_config_id,prompt_version_id,temperature,sort_order",
      );
      expect(eq).toHaveBeenCalledWith(
        "setting_id",
        "11111111-1111-4111-8111-111111111111",
      );
      expect(order).toHaveBeenCalledWith("sort_order", {
        ascending: true,
      });

      expect(result).toEqual(rows);
    });

    it("구성이 없으면 빈 배열을 반환한다", async () => {
      const order = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const eq = vi.fn().mockReturnValue({
        order,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      await expect(
        getAdminAiSettingConfigurationsInternal(
          "11111111-1111-4111-8111-111111111111",
        ),
      ).resolves.toEqual([]);
    });

    it("AI 설정 구성 조회에 실패하면 예외를 던진다", async () => {
      const order = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: "database error",
        },
      });

      const eq = vi.fn().mockReturnValue({
        order,
      });

      const select = vi.fn().mockReturnValue({
        eq,
      });

      const from = vi.fn().mockReturnValue({
        select,
      });

      vi.mocked(createAdminClient).mockReturnValue({
        from,
      } as never);

      await expect(
        getAdminAiSettingConfigurationsInternal(
          "11111111-1111-4111-8111-111111111111",
        ),
      ).rejects.toThrow(
        "Failed to load AI setting configurations: database error",
      );
    });
  });
});
