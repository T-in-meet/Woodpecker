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
 * @param hasRunningRecommendationExecution AI 추천 실행 진행 여부
 * @param hasFailedRecommendationExecution AI 추천 실행 실패 여부
 * @param isPollingTimedOut AI 추천 polling timeout 여부
 */
function mockRelatedNotesSectionData(
  hasRunningRecommendationExecution: boolean,
  hasFailedRecommendationExecution = false,
  isPollingTimedOut = false,
) {
  useRelatedNotesMock.mockReturnValue({
    data: {
      hasFailedRecommendationExecution,
      hasRunningRecommendationExecution,
      relatedNotes: [],
    },
    isLoading: false,
    isPollingTimedOut,
  } as unknown as ReturnType<typeof useRelatedNotes>);
}

/**
 * Related Notes section 조회 실패 hook 응답 mock을 설정합니다.
 */
function mockRelatedNotesSectionError() {
  useRelatedNotesMock.mockReturnValue({
    data: undefined,
    isError: true,
    isLoading: false,
    isPollingTimedOut: false,
  } as unknown as ReturnType<typeof useRelatedNotes>);
}

describe("RelatedNotesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 추천 실행이 진행 중이면 추가 버튼 옆에 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionData(true);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(screen.getByText("관련 노트를 찾고 있어요")).toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("AI 추천 polling 시간이 초과되면 지연 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionData(true, false, true);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.getByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트를 찾고 있어요"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("AI 추천 실행이 끝나면 안내 문구를 표시하지 않는다", () => {
    mockRelatedNotesSectionData(false);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.queryByText("관련 노트를 찾고 있어요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 추천에 실패했습니다."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("아직 연결된 관련 노트가 없습니다."),
    ).toBeInTheDocument();
  });

  it("AI 추천 실행에 실패하면 실패 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionData(false, true);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.getByText("관련 노트 추천에 실패했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트를 찾고 있어요"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("관련 노트 생성이 예상보다 오래 걸리고 있어요."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });

  it("Related Notes 조회에 실패하면 실패 안내 문구를 표시한다", () => {
    mockRelatedNotesSectionError();

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.getByText("관련 노트를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("아직 연결된 관련 노트가 없습니다."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "관련 노트 추가" }),
    ).toBeInTheDocument();
  });
});
