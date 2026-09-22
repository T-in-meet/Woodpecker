import "./setup";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { NoteContent } from "../components/NoteContent";

describe("NoteContent", () => {
  it("renders empty state when markdown content is empty", () => {
    render(<NoteContent content="" className="viewer-shell" />);

    const empty = screen.getByText("미리보기할 내용이 없습니다.");
    expect(empty).toHaveClass("viewer-shell");
    expect(document.querySelector(".tiptap")).toBeNull();
  });

  it("renders the note body as read-only tiptap markup on the server", () => {
    render(<NoteContent content="- [ ] first" className="viewer-shell" />);

    const editor = document.querySelector(".tiptap-wrapper .tiptap");
    expect(editor).toHaveAttribute("contenteditable", "false");
    expect(editor).toHaveClass("ProseMirror");

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    expect(checkbox.closest("[contenteditable='false']")).toBe(editor);
    expect(screen.getByText("first")).toBeInTheDocument();

    const wrapper = editor?.closest(".tiptap-wrapper");
    expect(wrapper).toHaveClass("viewer-shell");
    expect(wrapper?.className).toContain("[&_.tiptap]:px-1.5!");
  });

  it("renders markdown links and safe images", () => {
    render(
      <NoteContent content="[OpenAI](https://openai.com)\n\n![Architecture diagram](https://example.com/diagram.png)" />,
    );

    expect(screen.getByRole("link", { name: "OpenAI" })).toHaveAttribute(
      "href",
      "https://openai.com",
    );
    expect(
      screen.getByRole("img", { name: "Architecture diagram" }),
    ).toHaveAttribute("src", "https://example.com/diagram.png");
  });

  it("does not render images with unsafe or relative sources", () => {
    render(
      <NoteContent content="![Unsafe image](javascript:alert(1))\n\n![Relative image](../api/internal.png)" />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
