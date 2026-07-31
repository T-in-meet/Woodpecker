import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";

const { markReadMutateAsyncMock, routerPushMock } = vi.hoisted(() => ({
  markReadMutateAsyncMock: vi.fn(),
  routerPushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock("../hooks/use-mark-admin-notifications-as-read", () => ({
  useMarkAdminNotificationsAsRead: () => ({
    mutateAsync: markReadMutateAsyncMock,
  }),
}));

import {
  AdminNotificationList,
  type AdminNotificationListItemType,
} from "./AdminNotificationList";

const ADMIN_NOTIFICATION_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_CLICK_PATH = "/admin/operational-errors/error-id";

/**
 * 관리자 알림 목록 테스트용 item을 생성합니다.
 */
function createAdminNotificationItem(): AdminNotificationListItemType {
  return {
    body: "운영 오류가 발생했습니다.",
    click_path: ADMIN_CLICK_PATH,
    id: ADMIN_NOTIFICATION_ID,
    note_id: null,
    noteTitle: null,
    read_at: null,
    review_log_id: null,
    sent_at: "2026-07-27T01:00:00.000Z",
    source: "ADMIN",
    status: "SENT",
    title: "운영 오류 알림",
    type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
  };
}

describe("AdminNotificationList", () => {
  beforeEach(() => {
    markReadMutateAsyncMock.mockReset();
    routerPushMock.mockReset();
  });

  it("marks an admin notification as read before navigation", async () => {
    const user = userEvent.setup();
    const onItemRead = vi.fn();
    const onItemNavigate = vi.fn();
    markReadMutateAsyncMock.mockResolvedValue({
      ok: true,
      updated: 1,
    });

    render(
      <AdminNotificationList
        items={[createAdminNotificationItem()]}
        onItemNavigate={onItemNavigate}
        onItemRead={onItemRead}
      />,
    );

    await user.click(screen.getByRole("link", { name: /운영 오류 알림/ }));

    expect(markReadMutateAsyncMock).toHaveBeenCalledWith({
      clickPath: ADMIN_CLICK_PATH,
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });
    expect(onItemRead).toHaveBeenCalledWith(ADMIN_NOTIFICATION_ID);
    expect(onItemNavigate).toHaveBeenCalledOnce();
    expect(routerPushMock).toHaveBeenCalledWith(ADMIN_CLICK_PATH);
  });
});
