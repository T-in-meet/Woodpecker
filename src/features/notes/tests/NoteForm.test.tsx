import "./setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NOTE_LANGUAGE_VALUES } from "@/lib/constants/noteLanguages";
import { getNoteDetailRoute } from "@/lib/constants/routes";

const { createNoteActionMock, routerPushMock } = vi.hoisted(() => ({
  createNoteActionMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

import { NoteForm } from "../components/NoteForm";

vi.mock("@/features/editor/components/TipTapEditor", () => ({
  TipTapEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <button
      type="button"
      data-testid="tiptap-editor"
      onClick={() => onChange("markdown content")}
    >
      markdown:{value}
    </button>
  ),
}));

vi.mock("@/features/editor/components/CodeEditor", () => ({
  CodeEditor: ({
    value,
    language,
    onChange,
  }: {
    value: string;
    language: string;
    onChange: (value: string) => void;
  }) => (
    <button
      type="button"
      data-testid="code-editor"
      data-language={language}
      onClick={() => onChange(`code:${language}`)}
    >
      code:{language}:{value}
    </button>
  ),
}));

vi.mock("../actions", () => ({
  createNoteAction: createNoteActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

function getForm(container: HTMLElement) {
  const form = container.querySelector("form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("form element not found");
  }

  return form;
}

function getHiddenContentInput(container: HTMLElement) {
  const hiddenContentInput = container.querySelector('input[name="content"]');

  if (!(hiddenContentInput instanceof HTMLInputElement)) {
    throw new Error("hidden content input not found");
  }

  return hiddenContentInput;
}

describe("NoteForm", () => {
  beforeEach(() => {
    createNoteActionMock.mockReset();
    createNoteActionMock.mockResolvedValue(null);
    routerPushMock.mockReset();
    history.replaceState(null, "", "/notes/new");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the tiptap editor by default with the supported language options", () => {
    render(<NoteForm />);

    const select = screen.getByLabelText("언어") as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.value);

    expect(select.value).toBe("markdown");
    expect(options).toEqual([...NOTE_LANGUAGE_VALUES]);
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("code-editor")).not.toBeInTheDocument();
  });

  it("switches to the code editor when a code language is selected", async () => {
    const user = userEvent.setup();

    render(<NoteForm />);

    const select = screen.getByLabelText("언어") as HTMLSelectElement;
    await user.selectOptions(select, "javascript");

    expect(select.value).toBe("javascript");
    expect(screen.getByTestId("code-editor")).toHaveAttribute(
      "data-language",
      "javascript",
    );
    expect(screen.queryByTestId("tiptap-editor")).not.toBeInTheDocument();
  });

  it("syncs editor content into the hidden input and form data", async () => {
    const user = userEvent.setup();
    const { container } = render(<NoteForm />);
    const form = getForm(container);
    const hiddenContentInput = getHiddenContentInput(container);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(screen.getByTestId("tiptap-editor"));

    const formData = new FormData(form);

    expect(hiddenContentInput.value).toBe("markdown content");
    expect(formData.get("title")).toBe("테스트 노트");
    expect(formData.get("language")).toBe("markdown");
    expect(formData.get("content")).toBe("markdown content");
  });

  it("preserves content when switching between markdown and code editors", async () => {
    const user = userEvent.setup();
    const { container } = render(<NoteForm />);
    const hiddenContentInput = getHiddenContentInput(container);
    const select = screen.getByLabelText("언어") as HTMLSelectElement;

    await user.click(screen.getByTestId("tiptap-editor"));
    expect(hiddenContentInput.value).toBe("markdown content");

    await user.selectOptions(select, "javascript");
    expect(screen.getByTestId("code-editor")).toHaveTextContent(
      "code:javascript:markdown content",
    );

    await user.click(screen.getByTestId("code-editor"));
    expect(hiddenContentInput.value).toBe("code:javascript");

    await user.selectOptions(select, "markdown");
    expect(screen.getByTestId("tiptap-editor")).toHaveTextContent(
      "markdown:code:javascript",
    );
  });

  it("renders validation messages returned from the action", async () => {
    const user = userEvent.setup();
    createNoteActionMock.mockResolvedValueOnce({
      error: {
        title: ["제목을 입력해주세요"],
        language: ["지원하지 않는 언어입니다"],
        content: ["내용을 입력해주세요"],
      },
    });

    render(<NoteForm />);

    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("제목을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("지원하지 않는 언어입니다")).toBeInTheDocument();
    expect(screen.getByText("내용을 입력해주세요")).toBeInTheDocument();
  });

  it("renders a general action error", async () => {
    const user = userEvent.setup();
    createNoteActionMock.mockResolvedValueOnce({
      error: "로그인이 필요합니다.",
    });

    render(<NoteForm />);

    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("로그인이 필요합니다.")).toBeInTheDocument();
  });

  it("저장 성공 후 이탈 방지를 해제하고 상세 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    createNoteActionMock.mockResolvedValueOnce({
      success: true,
      newNoteId: "note-123",
    });
    routerPushMock.mockImplementationOnce((href: string) => {
      history.pushState(null, "", href);
    });

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(screen.getByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith(
        getNoteDetailRoute("note-123"),
      );
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(getNoteDetailRoute("note-123"));
  });

  it("저장 중에도 페이지 이탈 방지가 활성화된다", async () => {
    const user = userEvent.setup();
    let resolveAction: (state: null) => void = () => {};
    createNoteActionMock.mockReturnValueOnce(
      new Promise<null>((resolve) => {
        resolveAction = resolve;
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "저장 중..." })).toBeDisabled();
    });

    history.pushState(null, "", "/after-submit");

    expect(confirmSpy).toHaveBeenCalled();
    expect(window.location.pathname).not.toBe("/after-submit");

    resolveAction(null);
  });
});
