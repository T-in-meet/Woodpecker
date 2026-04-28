import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";

const { markNotificationAsReadActionMock } = vi.hoisted(() => ({
  markNotificationAsReadActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  markNotificationAsReadAction: markNotificationAsReadActionMock,
}));

import { NotificationBell } from "../components/NotificationBell";

const NOTIFICATION_RESPONSE = {
  unreadCount: 1,
  items: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "복습할 시간이에요!",
      body: "노트 내용을 다시 꺼내볼 차례입니다.",
      type: NOTIFICATION_TYPES.REVIEW,
      status: NOTIFICATION_STATUS.SENT,
      sent_at: "2026-04-28T03:00:00.000Z",
      read_at: null,
      note_id: "22222222-2222-4222-8222-222222222222",
      review_log_id: "33333333-3333-4333-8333-333333333333",
      noteTitle: "간격 반복 정리",
    },
  ],
};

function renderNotificationBell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    markNotificationAsReadActionMock.mockReset();
    markNotificationAsReadActionMock.mockResolvedValue({
      success: true,
      updated: true,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(NOTIFICATION_RESPONSE), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches notifications and opens the bell list", async () => {
    const user = userEvent.setup();
    renderNotificationBell();

    const button = await screen.findByRole("button", {
      name: "읽지 않은 알림 1개",
    });

    await user.click(button);

    expect(await screen.findByText("알림")).toBeVisible();
    expect(screen.getByText("복습할 시간이에요!")).toBeInTheDocument();
    expect(screen.getByText("간격 반복 정리")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/notifications", {
      credentials: "same-origin",
    });
  });

  it("closes the list and marks the item as read when a notification link is clicked", async () => {
    const user = userEvent.setup();
    renderNotificationBell();

    await user.click(
      await screen.findByRole("button", {
        name: "읽지 않은 알림 1개",
      }),
    );

    const link = await screen.findByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());

    await user.click(link);

    await waitFor(() => {
      expect(markNotificationAsReadActionMock).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      );
    });
    expect(screen.queryByText("간격 반복 정리")).not.toBeInTheDocument();
  });

  it("shows an error state instead of treating unauthorized responses as empty", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    renderNotificationBell();

    await user.click(await screen.findByRole("button", { name: "알림" }));

    expect(
      await screen.findByText("알림을 불러오지 못했습니다."),
    ).toBeInTheDocument();
  });
});
