import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { NoteChatConversationHeader } from "./NoteChatConversationHeader";

const CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";

vi.mock("./NoteChatConversationMenu", () => ({
  NoteChatConversationMenu: ({ title }: { title: string }) => (
    <div data-testid="conversation-menu">{title}</div>
  ),
}));

describe("NoteChatConversationHeader", () => {
  it("정상 조회 시 Conversation 제목과 메뉴를 표시한다", () => {
    render(
      <NoteChatConversationHeader
        conversationId={CONVERSATION_ID}
        conversationTitle="테스트 대화"
        isError={false}
        isLoading={false}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "노트 챗봇",
      }),
    ).toHaveAttribute("href", ROUTES.NOTE_CHATS);

    expect(
      screen.getByRole("link", {
        name: "테스트 대화",
      }),
    ).toHaveAttribute("aria-current", "page");

    expect(screen.getByTestId("conversation-menu")).toHaveTextContent(
      "테스트 대화",
    );
  });

  it("상세 조회 중에는 Header Skeleton을 표시한다", () => {
    const { container } = render(
      <NoteChatConversationHeader
        conversationId={CONVERSATION_ID}
        conversationTitle={undefined}
        isError={false}
        isLoading={true}
      />,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();

    expect(
      screen.queryByRole("link", {
        name: "노트 챗봇",
      }),
    ).not.toBeInTheDocument();

    expect(screen.queryByTestId("conversation-menu")).not.toBeInTheDocument();
  });

  it("상세 조회 실패 시 오류 상태를 Breadcrumb 제목으로 표시한다", () => {
    render(
      <NoteChatConversationHeader
        conversationId={CONVERSATION_ID}
        conversationTitle={undefined}
        isError={true}
        isLoading={false}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "노트 챗봇",
      }),
    ).toHaveAttribute("href", ROUTES.NOTE_CHATS);

    expect(screen.getByText("대화를 불러오지 못했습니다")).toBeInTheDocument();

    expect(screen.queryByTestId("conversation-menu")).not.toBeInTheDocument();
  });

  it("Conversation을 찾을 수 없으면 없음 상태를 Breadcrumb 제목으로 표시한다", () => {
    render(
      <NoteChatConversationHeader
        conversationId={CONVERSATION_ID}
        conversationTitle={undefined}
        isError={false}
        isLoading={false}
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "노트 챗봇",
      }),
    ).toHaveAttribute("href", ROUTES.NOTE_CHATS);

    expect(screen.getByText("대화를 찾을 수 없습니다")).toBeInTheDocument();

    expect(screen.queryByTestId("conversation-menu")).not.toBeInTheDocument();
  });
});
