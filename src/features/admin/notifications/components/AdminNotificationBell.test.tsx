import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";

import { ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY } from "../query-keys";

const {
  getAdminNotificationListMock,
  getAdminUnreadNotificationCountsMock,
  markAllMutateAsyncMock,
  markReadMutateAsyncMock,
  usePathnameMock,
} = vi.hoisted(() => ({
  getAdminNotificationListMock: vi.fn(),
  getAdminUnreadNotificationCountsMock: vi.fn(),
  markAllMutateAsyncMock: vi.fn(),
  markReadMutateAsyncMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/admin/notifications/queries", () => ({
  getAdminNotificationList: getAdminNotificationListMock,
  getAdminUnreadNotificationCounts: getAdminUnreadNotificationCountsMock,
}));

vi.mock("../hooks/use-mark-admin-notifications-as-read", () => ({
  useMarkAllAdminNotificationsAsRead: () => ({
    isPending: false,
    mutateAsync: markAllMutateAsyncMock,
  }),
  useMarkAdminNotificationsAsRead: () => ({
    mutateAsync: markReadMutateAsyncMock,
  }),
}));

import { AdminNotificationBell } from "./AdminNotificationBell";

const ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";

/**
 * 관리자 알림 Bell을 QueryClientProvider와 함께 렌더링합니다.
 */
function renderAdminNotificationBell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <AdminNotificationBell adminUserId={ADMIN_USER_ID} />
    </QueryClientProvider>,
  );

  return { queryClient, ...view };
}

describe("AdminNotificationBell", () => {
  beforeEach(() => {
    getAdminNotificationListMock.mockReset();
    getAdminUnreadNotificationCountsMock.mockReset();
    markAllMutateAsyncMock.mockReset();
    markReadMutateAsyncMock.mockReset();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue("/admin");
    getAdminNotificationListMock.mockResolvedValue([
      {
        body: "운영 오류가 발생했습니다.",
        click_path: "/admin/operational-errors/error-id",
        id: "22222222-2222-4222-8222-222222222222",
        note_id: null,
        noteTitle: null,
        read_at: null,
        review_log_id: null,
        sent_at: "2026-07-27T01:00:00.000Z",
        source: "ADMIN",
        status: "SENT",
        title: "운영 오류 알림",
        type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
      },
    ]);
    getAdminUnreadNotificationCountsMock.mockResolvedValue({
      [ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR]: 1,
    });
    markAllMutateAsyncMock.mockResolvedValue({
      ok: true,
      updated: 1,
    });
  });

  it("renders admin notifications and marks only admin notifications as read in bulk", async () => {
    const user = userEvent.setup();
    renderAdminNotificationBell();

    await user.click(
      await screen.findByRole("button", {
        name: "읽지 않은 관리자 알림 1개",
      }),
    );

    expect(
      screen.getByRole("button", { name: "읽지 않은 관리자 알림 1개" }),
    ).toHaveAttribute("title", "관리자 알림");

    expect(await screen.findByText("운영 오류 알림")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "전체 읽음" }));

    expect(markAllMutateAsyncMock).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(
        screen.getByText("새 관리자 알림이 없습니다."),
      ).toBeInTheDocument();
    });
  });

  it("uses the shared sidebar unread count query and fetches the list only when opened", async () => {
    const user = userEvent.setup();
    renderAdminNotificationBell();

    expect(getAdminNotificationListMock).not.toHaveBeenCalled();

    await screen.findByRole("button", {
      name: "읽지 않은 관리자 알림 1개",
    });

    expect(getAdminUnreadNotificationCountsMock).toHaveBeenCalledOnce();
    expect(getAdminNotificationListMock).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "읽지 않은 관리자 알림 1개",
      }),
    );

    await waitFor(() => {
      expect(getAdminNotificationListMock).toHaveBeenCalledOnce();
    });
  });

  it("refreshes the open admin notification list when the shared unread count changes", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderAdminNotificationBell();

    await user.click(
      await screen.findByRole("button", {
        name: "읽지 않은 관리자 알림 1개",
      }),
    );
    await waitFor(() => {
      expect(getAdminNotificationListMock).toHaveBeenCalledOnce();
    });

    queryClient.setQueryData(ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY.all, {
      [ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR]: 2,
    });

    await waitFor(() => {
      expect(getAdminNotificationListMock).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.getByRole("button", {
        name: "읽지 않은 관리자 알림 2개",
      }),
    ).toBeInTheDocument();
  });
});
