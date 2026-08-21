import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRelatedNotes } from "../hooks/use-related-notes";
import { RelatedNotesSection } from "./RelatedNotesSection";

vi.mock("../hooks/use-related-notes", () => ({
  useRelatedNotes: vi.fn(),
}));

vi.mock("./AddRelatedNoteDialog", () => ({
  AddRelatedNoteDialog: () => <button type="button">관련 노트 추가</button>,
}));

vi.mock("./RelatedNoteItem", () => ({
  RelatedNoteItem: ({ relatedNote }: { relatedNote: { title: string } }) => (
    <div>{relatedNote.title}</div>
  ),
}));

const useRelatedNotesMock = vi.mocked(useRelatedNotes);

/**
 * Related Notes section hook 응답 mock을 설정합니다.
 *
 * @param hasRunningRecommendationRun AI 추천 Run 진행 여부
 */
function mockRelatedNotesSectionData(hasRunningRecommendationRun: boolean) {
  useRelatedNotesMock.mockReturnValue({
    data: {
      hasRunningRecommendationRun,
      relatedNotes: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof useRelatedNotes>);
}

describe("RelatedNotesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 추천 Run이 진행 중이면 추가 버튼 옆에 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionData(true);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.getByText("AI 관련 노트를 추천하고 있습니다..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("AI 추천 Run이 끝나면 안내 문구를 표시하지 않는다", () => {
    mockRelatedNotesSectionData(false);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.queryByText("AI 관련 노트를 추천하고 있습니다..."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("아직 연결된 관련 노트가 없습니다."),
    ).toBeInTheDocument();
  });
});
