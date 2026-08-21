import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";

const { routerPushMock, routerReplaceMock, usePathnameMock } = vi.hoisted(
  () => ({
    routerPushMock: vi.fn(),
    routerReplaceMock: vi.fn(),
    usePathnameMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
}));

import {
  NotificationBell,
  removeReadNotificationFromResponse,
} from "../components/NotificationBell";
import type { NotificationsResponseType } from "../schema";

const USER_A_ID = "11111111-1111-4111-8111-111111111111";
const USER_B_ID = "22222222-2222-4222-8222-222222222222";

const NOTIFICATION_RESPONSE: NotificationsResponseType = {
  unreadCount: 1,
  items: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Review reminder",
      body: "Review body",
      click_path: "/notes/44444444-4444-4444-8444-444444444444/review",
      type: NOTIFICATION_TYPES.REVIEW,
      status: NOTIFICATION_STATUS.SENT,
      source: "USER",
      sent_at: "2026-04-28T03:00:00.000Z",
      read_at: null,
      note_id: "44444444-4444-4444-8444-444444444444",
      review_log_id: "55555555-5555-4555-8555-555555555555",
      noteTitle: "Interval note",
    },
  ],
};
const NOTIFICATION_ITEM = NOTIFICATION_RESPONSE.items[0]!;

function createJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderNotificationBell({
  queryClient = createTestQueryClient(),
  userId = USER_A_ID,
}: {
  queryClient?: QueryClient;
  userId?: string;
} = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell userId={userId} />
    </QueryClientProvider>,
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    usePathnameMock.mockReset();
    routerPushMock.mockReset();
    routerReplaceMock.mockReset();
    usePathnameMock.mockReturnValue("/notes");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse(NOTIFICATION_RESPONSE)),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches notifications and opens the bell list", async () => {
    const user = userEvent.setup();
    renderNotificationBell();

    await user.click(await screen.findByRole("button"));

    expect(await screen.findByText("Review reminder")).toBeInTheDocument();
    expect(screen.getByText("Interval note")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/notifications", {
      credentials: "same-origin",
    });
  });

  it("closes the list without exposing manual read controls when a notification link is clicked", async () => {
    const user = userEvent.setup();
    renderNotificationBell();

    await user.click(await screen.findByRole("button"));

    const link = await screen.findByRole("link");
    link.addEventListener("click", (event) => event.preventDefault());
    expect(
      screen.queryByRole("button", { name: /Review reminder/ }),
    ).not.toBeInTheDocument();

    await user.click(link);

    expect(screen.queryByText("Interval note")).not.toBeInTheDocument();
  });

  it("refetches notifications when the route changes after the cooldown", async () => {
    const queryClient = createTestQueryClient();

    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse(NOTIFICATION_RESPONSE))
      .mockResolvedValueOnce(
        createJsonResponse({
          unreadCount: 0,
          items: [],
        }),
      );

    const { rerender } = renderNotificationBell({ queryClient });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
    queryClient.setQueryData(
      ["notifications", USER_A_ID],
      NOTIFICATION_RESPONSE,
      {
        updatedAt: Date.now() - 30_001,
      },
    );

    usePathnameMock.mockReturnValue(
      "/notes/44444444-4444-4444-8444-444444444444",
    );
    rerender(
      <QueryClientProvider client={queryClient}>
        <NotificationBell userId={USER_A_ID} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("shows an error state instead of treating unauthorized responses as empty", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse({ error: "unauthorized" }, 401),
    );
    renderNotificationBell();

    await user.click(await screen.findByRole("button"));

    expect(
      await screen.findByText("알림을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("최신 법적 문서 확인이 필요하면 서버가 제공한 경로로 이동한다", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createJsonResponse(
        {
          error: "legal_acceptance_required",
          redirectTo: "/agreements?redirect=%2Fnotes",
        },
        403,
      ),
    );

    renderNotificationBell();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/agreements?redirect=%2Fnotes",
      );
    });
  });

  it("does not reuse cached notifications when the user id changes", async () => {
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();

    vi.mocked(fetch)
      .mockResolvedValueOnce(createJsonResponse(NOTIFICATION_RESPONSE))
      .mockResolvedValueOnce(createJsonResponse(NOTIFICATION_RESPONSE))
      .mockResolvedValueOnce(
        createJsonResponse({
          unreadCount: 0,
          items: [],
        }),
      );

    const { rerender } = renderNotificationBell({
      queryClient,
      userId: USER_A_ID,
    });

    await user.click(await screen.findByRole("button"));
    expect(await screen.findByText("Interval note")).toBeInTheDocument();

    rerender(
      <QueryClientProvider client={queryClient}>
        <NotificationBell userId={USER_B_ID} />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });
    expect(screen.queryByText("Interval note")).not.toBeInTheDocument();
  });
});

describe("removeReadNotificationFromResponse", () => {
  it("removes the matched notification and decreases the unread count", () => {
    expect(
      removeReadNotificationFromResponse(
        {
          unreadCount: 2,
          items: [
            NOTIFICATION_ITEM,
            {
              ...NOTIFICATION_ITEM,
              id: "66666666-6666-4666-8666-666666666666",
            },
          ],
        },
        "33333333-3333-4333-8333-333333333333",
      ),
    ).toEqual({
      unreadCount: 1,
      items: [
        {
          ...NOTIFICATION_ITEM,
          id: "66666666-6666-4666-8666-666666666666",
        },
      ],
    });
  });

  it("keeps the unread count unchanged when the notification is not cached", () => {
    const response = {
      unreadCount: 2,
      items: [NOTIFICATION_ITEM],
    };

    expect(
      removeReadNotificationFromResponse(
        response,
        "77777777-7777-4777-8777-777777777777",
      ),
    ).toBe(response);
  });
});
