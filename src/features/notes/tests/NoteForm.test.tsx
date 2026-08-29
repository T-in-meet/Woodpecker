import "./setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteDetailRoute } from "@/lib/constants/routes";

const { createNoteActionMock, routerReplaceMock } = vi.hoisted(() => ({
  createNoteActionMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}));

import { NoteForm } from "../components/NoteForm";

vi.mock("@/features/editor/components/TipTapEditor", () => ({
  TipTapEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <button
      type="button"
      data-testid="tiptap-editor"
      disabled={readOnly}
      onClick={() => onChange("markdown content")}
    >
      markdown:{value}
    </button>
  ),
}));

vi.mock("../actions", () => ({
  createNoteAction: createNoteActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
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
    routerReplaceMock.mockReset();
    history.replaceState(null, "", "/notes/new");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the tiptap editor", () => {
    render(<NoteForm />);

    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("노트 제목")).toBeInTheDocument();
    expect(
      screen.getByText("제목과 내용을 입력하면 저장할 수 있어요"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("제목과 내용을 모두 입력해야 저장할 수 있다", async () => {
    const user = userEvent.setup();

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");

    expect(screen.getByText("내용을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

    await user.click(screen.getByTestId("tiptap-editor"));

    expect(screen.getByText("저장되지 않은 변경사항")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
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
    expect(formData.get("content")).toBe("markdown content");
  });

  it("renders validation messages returned from the action", async () => {
    const user = userEvent.setup();
    createNoteActionMock.mockResolvedValueOnce({
      error: {
        title: ["제목을 입력해주세요"],
        content: ["내용을 입력해주세요"],
      },
    });

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(screen.getByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("제목을 입력해주세요")).toBeInTheDocument();
    expect(screen.getByText("내용을 입력해주세요")).toBeInTheDocument();
  });

  it("renders a general action error", async () => {
    const user = userEvent.setup();
    createNoteActionMock.mockResolvedValueOnce({
      error: "로그인이 필요합니다.",
    });

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(screen.getByTestId("tiptap-editor"));
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
    routerReplaceMock.mockImplementationOnce((href: string) => {
      history.replaceState(null, "", href);
    });

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(screen.getByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        getNoteDetailRoute("note-123"),
      );
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "저장 완료 · 노트로 이동 중…",
    );
    expect(screen.getByRole("button", { name: "저장됨" })).toBeDisabled();
    expect(screen.getByLabelText("제목")).toBeDisabled();
    expect(screen.getByTestId("tiptap-editor")).toBeDisabled();
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
    await user.click(screen.getByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "저장 중…" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("저장 중…");
    });

    history.pushState(null, "", "/after-submit");

    expect(confirmSpy).toHaveBeenCalled();
    expect(window.location.pathname).not.toBe("/after-submit");

    resolveAction(null);
  });
});
