import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminAiModelsClient } from "../models/components/AdminAiModelsClient";

vi.mock("@/features/admin/ai/models/hooks/use-admin-ai-model-queries", () => ({
  useAdminAiModels: () => ({
    data: {
      items: [
        {
          capability: "embedding",
          createdAt: "2026-08-03T00:00:00.000Z",
          displayName: "OpenAI text embedding 3 small",
          embeddingReferenceCount: 2,
          id: "11111111-1111-4111-8111-111111111111",
          isActive: true,
          model: "text-embedding-3-small",
          provider: "openai",
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
}));

describe("AdminAiModelsClient", () => {
  it("renders model configs in the management table", () => {
    render(<AdminAiModelsClient />);

    expect(screen.getByRole("heading", { name: "AI 모델" })).toBeVisible();
    expect(screen.getByText("OpenAI text embedding 3 small")).toBeVisible();
    expect(screen.getByText("text-embedding-3-small")).toBeVisible();
    expect(screen.getByText("active")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });
});
