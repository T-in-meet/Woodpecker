import "./setup";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("highlight.js/styles/github-dark.min.css", () => ({}));

import { NoteViewer } from "../components/NoteViewer";

describe("NoteViewer", () => {
  it("renders markdown notes through the markdown preview", () => {
    render(
      <NoteViewer
        content="- [ ] first"
        language="markdown"
        className="viewer-shell"
      />,
    );

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("first").closest(".viewer-shell")).toBeTruthy();
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
