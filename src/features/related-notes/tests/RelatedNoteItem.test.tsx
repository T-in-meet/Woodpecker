import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getNoteDetailRoute } from "@/lib/constants/routes";

import { RelatedNoteItem } from "../components/RelatedNoteItem";

const mutations = vi.hoisted(() => ({
  remove: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
}));

vi.mock("@/features/related-notes/hooks/use-delete-related-note", () => ({
  useDeleteRelatedNote: () => ({
    mutateAsync: mutations.remove,
    isPending: false,
  }),
}));
vi.mock(
  "@/features/related-notes/hooks/use-update-manual-related-note-reason",
  () => ({
    useUpdateManualRelatedNoteReason: () => ({
      mutateAsync: mutations.update,
      reset: mutations.reset,
      isPending: false,
    }),
  }),
);

const noteId = "11111111-1111-4111-8111-111111111111";
const relatedNoteId = "22222222-2222-4222-8222-222222222222";
// 링크 대상 노트 ID와 수정·삭제 대상 관계 ID를 구분해 검증한다.
const relationId = "33333333-3333-4333-8333-333333333333";
const title = "긴 관련 노트 제목 ".repeat(10);

function renderItem(origin: "manual" | "ai", reason: string) {
  return render(
    <RelatedNoteItem
      noteId={noteId}
      relatedNote={{ relationId, noteId: relatedNoteId, title, origin, reason }}
    />,
  );
}

describe("RelatedNoteItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["manual", "연결 이유"],
    ["manual", ""],
    ["ai", "추천 이유"],
    ["ai", ""],
  ] as const)(
    "%s / 이유 '%s': 터치 액션 너비와 기존 표시를 유지한다",
    (origin, reason) => {
      renderItem(origin, reason);

      const actions = screen.getByRole("button", {
        name: "관련 노트 삭제",
      }).parentElement!;
      expect(actions).toHaveClass("w-28", "shrink-0", "pointer-coarse:w-34");
      expect(within(actions).getAllByRole("button")).toHaveLength(
        reason ? 3 : 2,
      );
      expect(
        screen.getByText(origin === "manual" ? "직접 연결" : "AI 추천"),
      ).toBeVisible();
      expect(screen.getByRole("link")).toHaveAttribute(
        "href",
        getNoteDetailRoute(relatedNoteId),
      );
      expect(screen.getByRole("link").querySelector("span")).toHaveClass(
        "truncate",
      );
      expect(
        screen.queryByRole("button", { name: "관련 노트 수정" }) !== null,
      ).toBe(origin === "manual");
    },
  );

  it("이유 보기와 수정 저장 동작을 유지한다", async () => {
    const user = userEvent.setup();
    renderItem("manual", "기존 이유");
    await user.click(
      screen.getByRole("button", { name: "관련 노트 이유 보기" }),
    );
    expect(screen.getByText("기존 이유")).toBeVisible();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "관련 노트 수정" }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "새 이유");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(mutations.update).toHaveBeenCalledWith({
      noteId,
      relationId,
      reason: "새 이유",
    });
  });

  it.each(["manual", "ai"] as const)(
    "%s 삭제 확인 동작을 유지한다",
    async (origin) => {
      const user = userEvent.setup();
      renderItem(origin, "이유");
      await user.click(screen.getByRole("button", { name: "관련 노트 삭제" }));
      await user.click(
        within(screen.getByRole("alertdialog")).getByRole("button", {
          name: origin === "manual" ? "삭제" : "숨기기",
        }),
      );
      expect(mutations.remove).toHaveBeenCalledWith({ noteId, relationId });
    },
  );
});
