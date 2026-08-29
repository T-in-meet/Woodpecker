import "./setup";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoteActions } from "../components/NoteActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../actions", () => ({
  deleteNoteAction: vi.fn(),
}));

describe("NoteActions", () => {
  it("목록에서도 브라우저 confirm 대신 공통 삭제 다이얼로그를 연다", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");

    render(
      <NoteActions
        noteId="note-123"
        noteTitle="삭제할 노트"
        canReview={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "노트 삭제" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("삭제할 노트")).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
