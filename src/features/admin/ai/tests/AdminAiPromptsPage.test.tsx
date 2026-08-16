import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminAiPromptsClient } from "../prompts/components/AdminAiPromptsClient";

vi.mock("@/features/admin/ai/agents/hooks/use-admin-ai-agent-queries", () => ({
  useAdminAiAgentOptions: () => ({
    data: [
      {
        displayName: "Notes RAG Answer",
        id: "11111111-1111-4111-8111-111111111111",
      },
    ],
    isPending: false,
  }),
}));

vi.mock(
  "@/features/admin/ai/prompts/hooks/use-admin-ai-prompt-queries",
  () => ({
    useAdminAiPromptFamilies: () => ({
      data: {
        items: [
          {
            agentDisplayName: "Notes RAG Answer",
            agentId: "11111111-1111-4111-8111-111111111111",
            archivedVersionCount: 0,
            createdAt: "2026-08-03T00:00:00.000Z",
            displayName: "Evidence Strict",
            draftVersionCount: 1,
            id: "33333333-3333-4333-8333-333333333333",
            publishedVersionCount: 1,
            updatedAt: "2026-08-03T00:00:00.000Z",
          },
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
      isError: false,
      isPending: false,
    }),
  }),
);

describe("AdminAiPromptsClient", () => {
  it("Prompt Family 목록을 렌더링한다", () => {
    render(<AdminAiPromptsClient />);

    expect(screen.getByRole("heading", { name: "AI 프롬프트" })).toBeVisible();
    expect(screen.getByText("Notes RAG Answer")).toBeVisible();
    expect(screen.getByText("Evidence Strict")).toBeVisible();
  });
});
