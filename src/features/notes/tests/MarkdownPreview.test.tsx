import "./setup";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("highlight.js/styles/github-dark.min.css", () => ({}));

import { MarkdownPreview } from "../components/MarkdownPreview";

describe("MarkdownPreview", () => {
  it("renders task list checkboxes as read-only without a toggle handler", () => {
    render(<MarkdownPreview content="- [ ] first" />);

    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("emits the rendered checkbox index when task items are toggled", async () => {
    const user = userEvent.setup();
    const handleToggleCheckbox = vi.fn();

    render(
      <MarkdownPreview
        content={"1. [ ] first\n- [x] second"}
        onToggleCheckbox={handleToggleCheckbox}
      />,
    );

    const checkboxes = screen.getAllByRole("checkbox");

    expect(checkboxes).toHaveLength(2);

    const firstCheckbox = checkboxes[0];
    const secondCheckbox = checkboxes[1];

    if (!(firstCheckbox instanceof HTMLInputElement)) {
      throw new Error("first checkbox not found");
    }

    if (!(secondCheckbox instanceof HTMLInputElement)) {
      throw new Error("second checkbox not found");
    }

    expect(firstCheckbox).toBeEnabled();
    expect(secondCheckbox).toBeEnabled();

    await user.click(secondCheckbox);

    expect(handleToggleCheckbox).toHaveBeenCalledWith(1);
  });
});
