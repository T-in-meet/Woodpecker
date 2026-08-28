import "./setup";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteNoteDialog } from "../components/DeleteNoteDialog";

vi.mock("../actions", () => ({
  deleteNoteAction: vi.fn(),
}));

describe("DeleteNoteDialog", () => {
  it("allows long note titles to wrap inside the dialog", async () => {
    const noteTitle =
      "LongNoteTitleWithoutSpacesLongNoteTitleWithoutSpacesLongNoteTitle";

    render(
      <DeleteNoteDialog
        noteId="note-123"
        noteTitle={noteTitle}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(await screen.findByText(noteTitle)).toHaveClass(
      "max-w-full",
      "break-keep",
      "[overflow-wrap:anywhere]",
    );
  });

  it("닫혀 있으면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(
      <DeleteNoteDialog
        noteId="note-123"
        noteTitle="노트 제목"
        open={false}
        onOpenChange={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
