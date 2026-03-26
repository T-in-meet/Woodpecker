import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "../components/MarkdownEditor";

describe("MarkdownEditor", () => {
  it("does not emit onChange when the value prop is synced from outside", async () => {
    const handleChange = vi.fn();

    const { rerender } = render(
      <MarkdownEditor value="Initial content" onChange={handleChange} />,
    );

    await waitFor(() => {
      expect(document.querySelector(".cm-editor")).toBeTruthy();
    });

    handleChange.mockClear();

    rerender(
      <MarkdownEditor value="Updated content" onChange={handleChange} />,
    );

    await waitFor(() => {
      const content = document.querySelector(".cm-content")?.textContent;
      expect(content).toContain("Updated content");
    });

    expect(handleChange).not.toHaveBeenCalled();
  });
});
