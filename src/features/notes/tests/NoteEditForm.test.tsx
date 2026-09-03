import "./setup";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { NoteEditForm } from "../components/NoteEditForm";

const { updateMock } = vi.hoisted(() => ({ updateMock: vi.fn() }));
vi.mock("../actions", () => ({ updateNoteAction: updateMock }));
vi.mock("@/hooks/usePreventPageLeave", () => ({
  usePreventPageLeave: vi.fn(),
}));
vi.mock("@/features/editor/components/TipTapEditor", () => ({
  TipTapEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="내용"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

function renderForm(content: string) {
  return render(
    <NoteEditForm
      noteId="note-123"
      initialTitle="제목"
      initialContent={content}
      onCancel={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  updateMock.mockResolvedValue(null);
});

it.each([49999, 50000, 50001])(
  "explains the save state at %i characters",
  (length) => {
    renderForm("가".repeat(length));
    const save = screen.getByRole("button", { name: "저장" });
    expect(
      screen.getByText(`${length.toLocaleString("ko-KR")} / 50,000`),
    ).toBeInTheDocument();
    expect(save).toHaveAccessibleDescription(/서식 문자를 포함한 길이입니다/);
    if (length > 50000) {
      expect(save).toBeDisabled();
      expect(save).toHaveAccessibleDescription(/1자를 줄여주세요/);
    } else expect(save).toBeEnabled();
    expect(screen.getByLabelText("내용")).toHaveValue("가".repeat(length));
  },
);

it("restores saving after shortening content without discarding input", () => {
  renderForm("가".repeat(50120));
  expect(screen.getByText(/120자를 줄여주세요/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("내용"), {
    target: { value: "나".repeat(50000) },
  });
  expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  expect(screen.queryByText(/줄여주세요/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("내용")).toHaveValue("나".repeat(50000));
});

it("announces pending save and keeps its controls disabled", async () => {
  let finish: (value: null) => void = () => {};
  updateMock.mockReturnValueOnce(
    new Promise<null>((resolve) => {
      finish = resolve;
    }),
  );
  renderForm("내용");
  await userEvent.setup().click(screen.getByRole("button", { name: "저장" }));
  expect(
    await screen.findByRole("button", { name: "저장 중…" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
  await act(async () => finish(null));
});

it("associates server title errors with the focused title input", async () => {
  updateMock.mockResolvedValueOnce({
    error: { title: ["제목을 입력해주세요"] },
  });
  renderForm("내용");
  expect(screen.getByLabelText("제목")).toHaveFocus();
  await userEvent.setup().click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(screen.getByLabelText("제목")).toHaveAccessibleDescription(
      "제목을 입력해주세요",
    ),
  );
  expect(screen.getByLabelText("제목")).toHaveAttribute("aria-invalid", "true");
});
