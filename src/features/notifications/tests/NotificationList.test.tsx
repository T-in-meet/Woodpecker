import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";
import { getNoteReviewRoute } from "@/lib/constants/routes";

const { markNotificationAsReadActionMock, routerPushMock } = vi.hoisted(() => ({
  markNotificationAsReadActionMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("../actions", () => ({
  markNotificationAsReadAction: markNotificationAsReadActionMock,
}));

import type { UserNotificationListItemType } from "../components/NotificationList";
import { NotificationList } from "../components/NotificationList";

const NOTIFICATION_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";

function createNotificationItem(): UserNotificationListItemType {
  return {
    id: NOTIFICATION_ID,
    title: "복습할 시간이에요!",
    body: "노트 내용을 다시 꺼내볼 차례입니다.",
    click_path: getNoteReviewRoute(NOTE_ID),
    type: NOTIFICATION_TYPES.REVIEW,
    status: NOTIFICATION_STATUS.SENT,
    sent_at: "2026-04-28T03:00:00.000Z",
    read_at: null,
    note_id: NOTE_ID,
    review_log_id: "33333333-3333-4333-8333-333333333333",
    noteTitle: "간격 반복 정리",
    source: "USER",
  };
}

describe("NotificationList", () => {
  beforeEach(() => {
    markNotificationAsReadActionMock.mockReset();
    routerPushMock.mockReset();
  });

  it("renders notification items with review links", () => {
    render(<NotificationList items={[createNotificationItem()]} />);

    expect(screen.getByText("복습할 시간이에요!")).toBeInTheDocument();
    expect(screen.getByText("간격 반복 정리")).toBeInTheDocument();
    expect(screen.getByText("새 알림")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      getNoteReviewRoute(NOTE_ID),
    );
  });

  it("uses type labels when a notification has no body or note title", () => {
    render(
      <NotificationList
        items={[
          {
            ...createNotificationItem(),
            body: null,
            click_path: "/",
            note_id: null,
            noteTitle: null,
            review_log_id: null,
            title: "공지",
            type: NOTIFICATION_TYPES.SYSTEM,
          },
        ]}
      />,
    );

    expect(screen.getByText("시스템")).toBeInTheDocument();
    expect(screen.queryByText("복습 알림")).not.toBeInTheDocument();
  });

  // 알림 상태와 복습 완료는 분리한다. 확인하는 순간 소비되고, 복습을 실제로
  // 했는지는 복습 완료 RPC가 따로 반영한다.
  it("marks review notifications as read before navigation", async () => {
    const user = userEvent.setup();
    const onItemRead = vi.fn();
    const onItemNavigate = vi.fn();
    const item = createNotificationItem();
    markNotificationAsReadActionMock.mockResolvedValue({
      success: true,
      updated: true,
    });

    render(
      <NotificationList
        items={[item]}
        onItemRead={onItemRead}
        onItemNavigate={onItemNavigate}
      />,
    );

    await user.click(screen.getByRole("link"));

    expect(markNotificationAsReadActionMock).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      item.click_path,
    );
    expect(onItemRead).toHaveBeenCalledWith(NOTIFICATION_ID);
    expect(onItemNavigate).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith(item.click_path);
  });

  it("marks feedback reply notifications as read before navigation", async () => {
    const user = userEvent.setup();
    const onItemRead = vi.fn();
    const onItemNavigate = vi.fn();
    const item = {
      ...createNotificationItem(),
      body: "답변이 등록되었습니다.",
      click_path: "/mypage?feedbackId=feedback-id",
      note_id: null,
      noteTitle: null,
      review_log_id: null,
      title: "피드백 답변이 등록되었습니다.",
      type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
    } satisfies UserNotificationListItemType;
    markNotificationAsReadActionMock.mockResolvedValue({
      success: true,
      updated: true,
    });

    render(
      <NotificationList
        items={[item]}
        onItemRead={onItemRead}
        onItemNavigate={onItemNavigate}
      />,
    );

    await user.click(screen.getByRole("link"));

    expect(markNotificationAsReadActionMock).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      item.click_path,
    );
    expect(onItemRead).toHaveBeenCalledWith(NOTIFICATION_ID);
    expect(onItemNavigate).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith(
      "/mypage?feedbackId=feedback-id",
    );
  });

  it("keeps navigation when marking a generic notification as read fails", async () => {
    const user = userEvent.setup();
    const onItemRead = vi.fn();
    const onItemNavigate = vi.fn();
    const item = {
      ...createNotificationItem(),
      body: "답변이 등록되었습니다.",
      click_path: "/mypage?feedbackId=feedback-id",
      note_id: null,
      noteTitle: null,
      review_log_id: null,
      title: "피드백 답변이 등록되었습니다.",
      type: NOTIFICATION_TYPES.FEEDBACK_REPLY,
    } satisfies UserNotificationListItemType;
    markNotificationAsReadActionMock.mockRejectedValue(
      new Error("read failed"),
    );

    render(
      <NotificationList
        items={[item]}
        onItemRead={onItemRead}
        onItemNavigate={onItemNavigate}
      />,
    );

    await user.click(screen.getByRole("link"));

    expect(markNotificationAsReadActionMock).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      item.click_path,
    );
    expect(onItemRead).not.toHaveBeenCalled();
    expect(onItemNavigate).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith(
      "/mypage?feedbackId=feedback-id",
    );
  });

  it("does not mark already-read linked notifications again", async () => {
    const user = userEvent.setup();
    const onItemNavigate = vi.fn();

    render(
      <NotificationList
        items={[
          {
            ...createNotificationItem(),
            status: NOTIFICATION_STATUS.READ,
            read_at: "2026-04-28T04:00:00.000Z",
          },
        ]}
        onItemNavigate={onItemNavigate}
      />,
    );

    const link = screen.getByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);

    expect(markNotificationAsReadActionMock).not.toHaveBeenCalled();
    expect(onItemNavigate).toHaveBeenCalledOnce();
  });

  it("renders an empty state", () => {
    render(<NotificationList items={[]} />);

    expect(screen.getByText("새 알림이 없습니다.")).toBeInTheDocument();
  });
});
