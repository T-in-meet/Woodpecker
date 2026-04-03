import "./setup";

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("highlight.js/styles/github-dark.min.css", () => ({}));

import { NoteViewer } from "../components/NoteViewer";

describe("NoteViewer", () => {
  it("renders markdown notes through the tiptap readonly editor", async () => {
    render(
      <NoteViewer
        content="- [ ] first"
        language="markdown"
        className="viewer-shell"
      />,
    );

    await waitFor(() => {
      const editor = document.querySelector("[contenteditable='false']");
      expect(editor).toBeTruthy();
    });

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("first").closest(".viewer-shell")).toBeTruthy();
  });

  it("renders empty state when markdown content is empty", () => {
    render(<NoteViewer content="" language="markdown" />);

    expect(screen.getByText("미리보기할 내용이 없습니다.")).toBeInTheDocument();
  });

  it("renders markdown links in readonly mode", async () => {
    render(
      <NoteViewer content="[OpenAI](https://openai.com)" language="markdown" />,
    );

    const link = await screen.findByRole("link", { name: "OpenAI" });

    expect(link).toHaveAttribute("href", "https://openai.com");
  });

  it("renders code notes with syntax-highlighted markup", () => {
    const { container } = render(
      <NoteViewer content={"const answer = 42;"} language="typescript" />,
    );

    const codeElement = container.querySelector("code.language-typescript");

    expect(codeElement).toBeTruthy();
    expect(codeElement?.innerHTML).toContain("answer");
  });
});
