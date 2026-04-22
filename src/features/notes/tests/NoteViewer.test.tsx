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

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeDisabled();
    expect(checkbox.closest("[contenteditable='false']")).toBeTruthy();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("first").closest(".viewer-shell")).toBeTruthy();
    expect(
      document
        .querySelector("[contenteditable='false']")
        ?.closest(".tiptap-wrapper")?.className,
    ).toContain("[&_.tiptap]:px-0!");
  });

  it("preserves escaped task markers as literal markdown text", async () => {
    render(<NoteViewer content={"- \\[ \\] first"} language="markdown" />);

    await waitFor(() => {
      const editor = document.querySelector("[contenteditable='false']");
      expect(editor).toBeTruthy();
    });

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("[ ] first")).toBeInTheDocument();
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

  it("renders markdown images in readonly mode", async () => {
    render(
      <NoteViewer
        content="![Architecture diagram](https://example.com/diagram.png)"
        language="markdown"
      />,
    );

    const image = await screen.findByRole("img", {
      name: "Architecture diagram",
    });

    expect(image).toHaveAttribute("src", "https://example.com/diagram.png");
  });

  it("does not render markdown images with unsafe sources", async () => {
    render(
      <NoteViewer
        content="![Unsafe image](javascript:alert(1))"
        language="markdown"
      />,
    );

    await waitFor(() => {
      const editor = document.querySelector("[contenteditable='false']");
      expect(editor).toBeTruthy();
    });

    expect(
      screen.queryByRole("img", { name: "Unsafe image" }),
    ).not.toBeInTheDocument();
  });

  it("does not render markdown images with relative sources", async () => {
    render(
      <NoteViewer
        content="![Relative image](../api/internal.png)"
        language="markdown"
      />,
    );

    await waitFor(() => {
      const editor = document.querySelector("[contenteditable='false']");
      expect(editor).toBeTruthy();
    });

    expect(
      screen.queryByRole("img", { name: "Relative image" }),
    ).not.toBeInTheDocument();
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
