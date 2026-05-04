import "./setup";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteNoteDialog } from "../components/DeleteNoteDialog";

vi.mock("../actions", () => ({
  deleteNoteAction: vi.fn(),
}));

function getTriggerButton(container: HTMLElement) {
  const triggerButton = container.querySelector("button");

  if (!(triggerButton instanceof HTMLButtonElement)) {
    throw new Error("delete trigger button not found");
  }

  return triggerButton;
}

describe("DeleteNoteDialog", () => {
  it("allows long note titles to wrap inside the dialog", async () => {
    const user = userEvent.setup();
    const noteTitle =
      "LongNoteTitleWithoutSpacesLongNoteTitleWithoutSpacesLongNoteTitle";
    const { container } = render(
      <DeleteNoteDialog noteId="note-123" noteTitle={noteTitle} />,
    );

    await user.click(getTriggerButton(container));

    expect(await screen.findByText(noteTitle)).toHaveClass(
      "max-w-full",
      "break-keep",
      "[overflow-wrap:anywhere]",
    );
  });
});
