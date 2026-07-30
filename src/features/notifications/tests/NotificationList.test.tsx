import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ADMIN_NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";
import { getNoteReviewRoute } from "@/lib/constants/routes";

import { NotificationList } from "../components/NotificationList";
import type { NotificationListItemType } from "../schema";

const NOTIFICATION_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";

function createNotificationItem(): NotificationListItemType {
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
  it("renders notification items with review links", () => {
    render(<NotificationList items={[createNotificationItem()]} />);

    expect(screen.getByText("복습할 시간이에요!")).toBeInTheDocument();
    expect(screen.getByText("간격 반복 정리")).toBeInTheDocument();
    expect(screen.getByText("개인")).toBeInTheDocument();
    expect(screen.getByText("새 알림")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      getNoteReviewRoute(NOTE_ID),
    );
  });

  it("renders admin notification source labels", () => {
    render(
      <NotificationList
        items={[
          {
            ...createNotificationItem(),
            body: "notifications / dispatch_push / push_send",
            click_path:
              "/admin/operational-errors/44444444-4444-4444-8444-444444444444",
            note_id: null,
            noteTitle: null,
            review_log_id: null,
            source: "ADMIN",
            title: "Push 알림 전송에 실패했습니다.",
            type: "OPERATIONAL_ERROR",
          },
        ]}
      />,
    );

    expect(screen.getByText("관리자")).toBeInTheDocument();
    expect(
      screen.getByText("notifications / dispatch_push / push_send"),
    ).toBeInTheDocument();
  });

  it("uses type labels when a notification has no body or note title", () => {
    render(
      <NotificationList
        items={[
          {
            ...createNotificationItem(),
            body: null,
            note_id: null,
            noteTitle: null,
            review_log_id: null,
            source: "ADMIN",
            title: "새 피드백이 도착했습니다.",
            type: ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
          },
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

    expect(screen.getByText("사용자 피드백")).toBeInTheDocument();
    expect(screen.getByText("시스템")).toBeInTheDocument();
    expect(screen.queryByText("복습 알림")).not.toBeInTheDocument();
  });

  it("notifies navigation without marking linked notifications as read", async () => {
    const user = userEvent.setup();
    const onItemNavigate = vi.fn();

    render(
      <NotificationList
        items={[createNotificationItem()]}
        onItemNavigate={onItemNavigate}
      />,
    );

    const link = screen.getByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);

    expect(
      screen.queryByRole("button", {
        name: "복습할 시간이에요! 읽음 처리",
      }),
    ).not.toBeInTheDocument();
    expect(onItemNavigate).toHaveBeenCalledOnce();
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

    expect(onItemNavigate).toHaveBeenCalledOnce();
  });

  it("renders an empty state", () => {
    render(<NotificationList items={[]} />);

    expect(screen.getByText("새 알림이 없습니다.")).toBeInTheDocument();
  });
});
