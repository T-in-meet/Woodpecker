import "@/tests/setup";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComparisonView } from "./ComparisonView";

describe("ComparisonView", () => {
  it("renders markdown images in both readonly panels", async () => {
    render(
      <ComparisonView
        userAnswer="![User answer image](https://example.com/user-answer.png)"
        originalContent="![Original image](https://example.com/original.png)"
      />,
    );

    const userAnswerImage = await screen.findByRole("img", {
      name: "User answer image",
    });
    const originalImage = await screen.findByRole("img", {
      name: "Original image",
    });

    expect(userAnswerImage).toHaveAttribute(
      "src",
      "https://example.com/user-answer.png",
    );
    expect(originalImage).toHaveAttribute(
      "src",
      "https://example.com/original.png",
    );
  });
});
