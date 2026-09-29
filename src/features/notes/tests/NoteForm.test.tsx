import "./setup";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteDetailRoute } from "@/lib/constants/routes";

const { createNoteActionMock, routerReplaceMock, editorFocusMock } = vi.hoisted(
  () => ({
    createNoteActionMock: vi.fn(),
    routerReplaceMock: vi.fn(),
    editorFocusMock: vi.fn(),
  }),
);

import { NoteForm } from "../components/NoteForm";

vi.mock("@/features/editor/components/TipTapEditor", async () => {
  const { useEffect } = await import("react");

  return {
    TipTapEditor: ({
      value,
      onChange,
      readOnly,
      onEditorReady,
    }: {
      value: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
      onEditorReady?: (editor: unknown) => void;
    }) => {
      useEffect(() => {
        // useMobileEditorSaveBar가 읽는 필드까지 갖춘 최소 에디터.
        onEditorReady?.({
          commands: { focus: editorFocusMock, scrollIntoView: vi.fn() },
          options: { editorProps: {} },
          setOptions: vi.fn(),
          isDestroyed: false,
          isFocused: false,
        });
        // 실제 TipTapEditor처럼 준비 콜백은 한 번만 호출한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return (
        <button
          type="button"
          data-testid="tiptap-editor"
          disabled={readOnly}
          onClick={() => onChange("markdown content")}
        >
          markdown:{value}
        </button>
      );
    },
  };
});

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
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    // 지연 로드와 무관한 테스트는 에디터를 곧바로 불러온다.
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    createNoteActionMock.mockReset();
    createNoteActionMock.mockResolvedValue(null);
    routerReplaceMock.mockReset();
    editorFocusMock.mockReset();
    history.replaceState(null, "", "/notes/new");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the tiptap editor", async () => {
    render(<NoteForm />);

    expect(await screen.findByTestId("tiptap-editor")).toBeInTheDocument();
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

    await user.click(await screen.findByTestId("tiptap-editor"));

    expect(screen.getByText("저장되지 않은 변경사항")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("syncs editor content into the hidden input and form data", async () => {
    const user = userEvent.setup();
    const { container } = render(<NoteForm />);
    const form = getForm(container);
    const hiddenContentInput = getHiddenContentInput(container);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(await screen.findByTestId("tiptap-editor"));

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
    await user.click(await screen.findByTestId("tiptap-editor"));
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
    await user.click(await screen.findByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("로그인이 필요합니다.")).toBeInTheDocument();
  });

  it("저장 성공 후 이탈 방지를 해제하고 상세 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    createNoteActionMock.mockResolvedValueOnce({
      success: true,
      newNoteId: "note-123",
    });
    routerReplaceMock.mockImplementationOnce((href: string) => {
      history.replaceState(null, "", href);
    });

    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(await screen.findByTestId("tiptap-editor"));
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
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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
    render(<NoteForm />);

    await user.type(screen.getByLabelText("제목"), "테스트 노트");
    await user.click(await screen.findByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "저장 중…" })).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("저장 중…");
    });

    await act(async () => {
      history.pushState(null, "", "/after-submit");
    });

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(window.location.pathname).not.toBe("/after-submit");

    resolveAction(null);
  });

  describe("에디터 지연 로드", () => {
    let runIdleCallback: (() => void) | undefined;

    beforeEach(() => {
      runIdleCallback = undefined;
      vi.stubGlobal(
        "requestIdleCallback",
        vi.fn((callback: () => void) => {
          runIdleCallback = callback;
          return 1;
        }),
      );
      vi.stubGlobal("cancelIdleCallback", vi.fn());
    });

    it("처음에는 서버 placeholder를 보여주고 유휴 시간에 에디터를 불러온다", async () => {
      const { container } = render(<NoteForm />);

      expect(
        container.querySelector("[data-static-placeholder]"),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("tiptap-editor")).not.toBeInTheDocument();

      act(() => {
        runIdleCallback?.();
      });

      expect(await screen.findByTestId("tiptap-editor")).toBeInTheDocument();
      expect(
        container.querySelector("[data-static-placeholder]"),
      ).not.toBeInTheDocument();
    });

    it("데스크톱 제목 자동 포커스만으로는 에디터를 불러오지 않는다", async () => {
      const { container, unmount } = render(<NoteForm />);

      expect(screen.getByLabelText("제목")).toHaveFocus();
      // 로드가 요청됐다면 모킹된 에디터 모듈이 해석될 시간을 준다.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.queryByTestId("tiptap-editor")).not.toBeInTheDocument();
      expect(
        container.querySelector("[data-static-placeholder]"),
      ).toBeInTheDocument();
      // 대기 중인 idle 콜백 정리는 전역 stub이 살아 있을 때 실행한다.
      unmount();
    });

    it("유휴 시간 전이라도 제목을 누르면 에디터를 불러온다", async () => {
      render(<NoteForm />);

      fireEvent.pointerDown(screen.getByLabelText("제목"));

      expect(await screen.findByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("requestIdleCallback이 없으면 상한 시간이 지난 뒤 에디터를 불러온다", async () => {
      vi.stubGlobal("requestIdleCallback", undefined);
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      try {
        render(<NoteForm />);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1999);
        });
        expect(screen.queryByTestId("tiptap-editor")).not.toBeInTheDocument();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
      } finally {
        vi.useRealTimers();
      }

      expect(await screen.findByTestId("tiptap-editor")).toBeInTheDocument();
    });

    it("유휴 시간 전이라도 본문 placeholder를 누르면 에디터를 불러와 포커스한다", async () => {
      const { container } = render(<NoteForm />);
      const shell = container.querySelector(
        "[data-static-placeholder]",
      )?.parentElement;

      if (!shell) {
        throw new Error("editor shell not found");
      }

      fireEvent.pointerDown(shell);

      expect(await screen.findByTestId("tiptap-editor")).toBeInTheDocument();
      expect(editorFocusMock).toHaveBeenCalledWith("start");
    });

    it("에디터가 준비되기 전에 제목에서 Enter를 누르면 준비된 뒤 본문으로 포커스한다", async () => {
      render(<NoteForm />);

      expect(screen.queryByTestId("tiptap-editor")).not.toBeInTheDocument();

      fireEvent.keyDown(screen.getByLabelText("제목"), { key: "Enter" });

      expect(await screen.findByTestId("tiptap-editor")).toBeInTheDocument();
      expect(editorFocusMock).toHaveBeenCalledWith("start");
    });
  });
});

afterEach(() => vi.unstubAllGlobals());
