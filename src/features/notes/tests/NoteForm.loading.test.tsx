import "./setup";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const {
  editorFocusMock,
  moduleStarted,
  editorModuleGate,
  releaseEditorModule,
} = vi.hoisted(() => {
  let releaseEditorModule: () => void = () => {};
  const editorModuleGate = new Promise<void>((resolve) => {
    releaseEditorModule = resolve;
  });
  return {
    editorFocusMock: vi.fn(),
    moduleStarted: vi.fn(),
    editorModuleGate,
    releaseEditorModule,
  };
});

vi.mock("@/features/editor/components/TipTapEditor", async () => {
  const { useEffect } = await import("react");
  moduleStarted();
  await editorModuleGate;
  return {
    TipTapEditor: ({
      onEditorReady,
    }: {
      onEditorReady: (editor: unknown) => void;
    }) => {
      useEffect(() => {
        onEditorReady({
          commands: { focus: editorFocusMock, scrollIntoView: vi.fn() },
          options: { editorProps: {} },
          setOptions: vi.fn(),
          isDestroyed: false,
          isFocused: false,
        });
        // 실제 에디터와 같이 준비 시 한 번만 호출한다.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="loaded-editor" />;
    },
  };
});

vi.mock("../actions", () => ({ createNoteAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { NoteForm } from "../components/NoteForm";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  vi.stubGlobal("requestIdleCallback", vi.fn().mockReturnValue(1));
  vi.stubGlobal("cancelIdleCallback", vi.fn());
});

afterEach(() => {
  releaseEditorModule();
  vi.unstubAllGlobals();
});

it("번들 다운로드 중 본문을 누르면 준비된 에디터로 포커스를 옮긴다", async () => {
  const { container } = render(<NoteForm />);
  fireEvent.pointerDown(screen.getByLabelText("제목"));
  await waitFor(() => expect(moduleStarted).toHaveBeenCalled());
  expect(screen.queryByTestId("loaded-editor")).not.toBeInTheDocument();
  const placeholder = container.querySelector("[data-static-placeholder]");
  if (!placeholder) throw new Error("editor placeholder not found");
  fireEvent.pointerDown(placeholder);

  await act(async () => releaseEditorModule());
  expect(await screen.findByTestId("loaded-editor")).toBeInTheDocument();
  expect(editorFocusMock).toHaveBeenCalledWith("start");
});
