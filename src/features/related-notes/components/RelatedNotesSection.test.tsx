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
 * @param recommendationUsage 오늘 AI 추천 사용량
 */
function mockRelatedNotesSectionData(
  hasRunningRecommendationExecution: boolean,
  hasFailedRecommendationExecution = false,
  isPollingTimedOut = false,
  recommendationUsage: {
    used: number;
    limit: number;
  } | null = null,
) {
  useRelatedNotesMock.mockReturnValue({
    data: {
      hasFailedRecommendationExecution,
      hasRunningRecommendationExecution,
      recommendationUsage,
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

  it("AI 추천 실행이 끝나고 사용량이 없으면 안내 문구를 표시하지 않는다", () => {
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
      screen.queryByText(/오늘은 이 노트의 AI 추천을 더 생성할 수 없어요/),
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

  it("일일 AI 추천 사용량이 있으면 사용량을 표시한다", () => {
    mockRelatedNotesSectionData(false, false, false, {
      used: 0,
      limit: 1,
    });

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(screen.getByText("오늘 0/1회 사용")).toBeInTheDocument();

    expect(
      screen.queryByText(/오늘은 이 노트의 AI 추천을 더 생성할 수 없어요/),
    ).not.toBeInTheDocument();
  });

  it("일일 AI 추천 사용량이 제한에 도달하면 제한 안내와 사용량을 함께 표시한다", () => {
    mockRelatedNotesSectionData(false, false, false, {
      used: 1,
      limit: 1,
    });

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.getByText("오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (1/1)"),
    ).toBeInTheDocument();

    expect(screen.queryByText("오늘 1/1회 사용")).not.toBeInTheDocument();
  });

  it("일일 추천 제한에 도달했더라도 실행 중이면 실행 안내를 우선 표시한다", () => {
    mockRelatedNotesSectionData(true, false, false, {
      used: 1,
      limit: 1,
    });

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(screen.getByText("관련 노트를 찾고 있어요")).toBeInTheDocument();

    expect(
      screen.queryByText(
        "오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (1/1)",
      ),
    ).not.toBeInTheDocument();

    expect(screen.queryByText("오늘 1/1회 사용")).not.toBeInTheDocument();
  });

  it("일일 추천 제한에 도달했더라도 실행 실패 상태면 실패 안내를 우선 표시한다", () => {
    mockRelatedNotesSectionData(false, true, false, {
      used: 1,
      limit: 1,
    });

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(
      screen.getByText("관련 노트 추천에 실패했습니다."),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (1/1)",
      ),
    ).not.toBeInTheDocument();

    expect(screen.queryByText("오늘 1/1회 사용")).not.toBeInTheDocument();
  });

  it("recommendationUsage가 null이면 일일 사용량을 표시하지 않는다", () => {
    mockRelatedNotesSectionData(false, false, false, null);

    render(
      <RelatedNotesSection noteId="11111111-1111-4111-8111-111111111111" />,
    );

    expect(screen.queryByText(/오늘 \d+\/\d+회 사용/)).not.toBeInTheDocument();

    expect(
      screen.queryByText(/오늘은 이 노트의 AI 추천을 더 생성할 수 없어요/),
    ).not.toBeInTheDocument();
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
