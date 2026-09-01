import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { completeReviewActionMock } = vi.hoisted(() => ({
  completeReviewActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  completeReviewAction: completeReviewActionMock,
}));

import { ReviewCompleteButton } from "./ReviewCompleteButton";

describe("ReviewCompleteButton", () => {
  it("enables completion by default", () => {
    render(
      <ReviewCompleteButton
        noteId="11111111-1111-4111-8111-111111111111"
        reviewLogId="22222222-2222-4222-8222-222222222222"
      />,
    );

    expect(screen.getByRole("button", { name: "복습 완료" })).toBeEnabled();
  });
});
