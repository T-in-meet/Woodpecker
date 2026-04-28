import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENDPOINT = "https://push.example.test/subscription-id";
const STALE_ENDPOINT = "https://push.example.test/stale-subscription-id";
const VAPID_PUBLIC_KEY = "AAAA";

const {
  checkPushSubscriptionOwnedActionMock,
  refreshMock,
  subscribeToPushActionMock,
  unsubscribeFromPushActionMock,
} = vi.hoisted(() => ({
  checkPushSubscriptionOwnedActionMock: vi.fn(),
  refreshMock: vi.fn(),
  subscribeToPushActionMock: vi.fn(),
  unsubscribeFromPushActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("../actions", () => ({
  checkPushSubscriptionOwnedAction: checkPushSubscriptionOwnedActionMock,
  subscribeToPushAction: subscribeToPushActionMock,
  unsubscribeFromPushAction: unsubscribeFromPushActionMock,
}));

const originalNotification = Object.getOwnPropertyDescriptor(
  window,
  "Notification",
);
const originalPushManager = Object.getOwnPropertyDescriptor(
  window,
  "PushManager",
);
const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

type SupportedPushEnvironmentOptionsType = {
  existingSubscription?: PushSubscription | null;
  permission?: NotificationPermission;
  subscribedSubscription?: PushSubscription;
};

function restoreDescriptor<T extends object>(
  target: T,
  key: keyof T,
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  Reflect.deleteProperty(target, key);
}

async function loadPushSubscribeCard() {
  const mod = await import("../components/PushSubscribeCard");
  return mod.PushSubscribeCard;
}

function createPushSubscription(endpoint = ENDPOINT) {
  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      keys: {
        auth: "auth-secret",
        p256dh: "p256dh-key",
      },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

function setupSupportedPushEnvironment({
  existingSubscription = null,
  permission = "default",
  subscribedSubscription = createPushSubscription(),
}: SupportedPushEnvironmentOptionsType = {}) {
  const requestPermissionMock = vi.fn().mockResolvedValue("granted");
  const notificationMock = {
    permission,
    requestPermission: requestPermissionMock,
  };
  const getSubscriptionMock = vi.fn().mockResolvedValue(existingSubscription);
  const subscribeMock = vi.fn().mockResolvedValue(subscribedSubscription);
  const registration = {
    pushManager: {
      getSubscription: getSubscriptionMock,
      subscribe: subscribeMock,
    },
  };
  const getRegistrationMock = vi.fn().mockResolvedValue(registration);
  const registerMock = vi.fn().mockResolvedValue(registration);

  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: notificationMock,
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: getRegistrationMock,
      ready: Promise.resolve(registration),
      register: registerMock,
    },
  });

  return {
    getRegistrationMock,
    getSubscriptionMock,
    registerMock,
    requestPermissionMock,
    subscribeMock,
    subscribedSubscription,
  };
}

describe("PushSubscribeCard", () => {
  beforeEach(() => {
    checkPushSubscriptionOwnedActionMock.mockResolvedValue({ owned: false });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    checkPushSubscriptionOwnedActionMock.mockReset();
    refreshMock.mockReset();
    subscribeToPushActionMock.mockReset();
    unsubscribeFromPushActionMock.mockReset();
    restoreDescriptor(window, "Notification", originalNotification);
    restoreDescriptor(window, "PushManager", originalPushManager);
    restoreDescriptor(navigator, "serviceWorker", originalServiceWorker);
  });

  it("renders a disabled state when push notifications are not supported", async () => {
    const PushSubscribeCard = await loadPushSubscribeCard();

    render(<PushSubscribeCard initialHasAnySubscription={false} />);

    expect(
      await screen.findByText("이 브라우저는 푸시 알림을 지원하지 않습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /알림 켜기/ })).toBeDisabled();
  });

  it("does not auto-resubscribe an existing browser subscription owned by the current user", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_PUBLIC_KEY);
    setupSupportedPushEnvironment({
      existingSubscription: createPushSubscription(),
      permission: "granted",
    });
    checkPushSubscriptionOwnedActionMock.mockResolvedValue({ owned: true });
    const PushSubscribeCard = await loadPushSubscribeCard();

    render(<PushSubscribeCard initialHasAnySubscription={true} />);

    expect(
      await screen.findByText("현재 브라우저에서 알림이 켜져 있습니다."),
    ).toBeInTheDocument();
    expect(checkPushSubscriptionOwnedActionMock).toHaveBeenCalledWith(ENDPOINT);
    expect(subscribeToPushActionMock).not.toHaveBeenCalled();
  });

  it("replaces a browser subscription left by a previous account before subscribing", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_PUBLIC_KEY);
    const staleSubscription = createPushSubscription(STALE_ENDPOINT);
    setupSupportedPushEnvironment({
      existingSubscription: staleSubscription,
      permission: "granted",
    });
    checkPushSubscriptionOwnedActionMock.mockResolvedValue({ owned: false });
    subscribeToPushActionMock.mockResolvedValue({ success: true });
    const PushSubscribeCard = await loadPushSubscribeCard();
    const user = userEvent.setup();

    render(<PushSubscribeCard initialHasAnySubscription={false} />);

    expect(
      await screen.findByText(
        "이 브라우저에 다른 계정의 구독이 남아있습니다. 알림 켜기를 누르면 새 구독으로 다시 설정합니다.",
      ),
    ).toBeInTheDocument();
    expect(checkPushSubscriptionOwnedActionMock).toHaveBeenCalledWith(
      STALE_ENDPOINT,
    );

    await user.click(screen.getByRole("button", { name: /알림 켜기/ }));

    await waitFor(() => {
      expect(staleSubscription.unsubscribe).toHaveBeenCalled();
      expect(subscribeToPushActionMock).toHaveBeenCalledWith({
        endpoint: ENDPOINT,
        keys: {
          auth: "auth-secret",
          p256dh: "p256dh-key",
        },
      });
    });
    expect(unsubscribeFromPushActionMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("이 브라우저에서 복습 알림을 받을 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("subscribes this browser when the user clicks the subscribe button", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_PUBLIC_KEY);
    const { requestPermissionMock, subscribeMock } =
      setupSupportedPushEnvironment();
    subscribeToPushActionMock.mockResolvedValue({ success: true });
    const PushSubscribeCard = await loadPushSubscribeCard();
    const user = userEvent.setup();

    render(<PushSubscribeCard initialHasAnySubscription={false} />);

    expect(
      await screen.findByText("현재 브라우저에서 알림이 꺼져 있습니다."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /알림 켜기/ }));

    await waitFor(() => {
      expect(subscribeToPushActionMock).toHaveBeenCalledWith({
        endpoint: ENDPOINT,
        keys: {
          auth: "auth-secret",
          p256dh: "p256dh-key",
        },
      });
    });
    expect(requestPermissionMock).toHaveBeenCalled();
    expect(subscribeMock).toHaveBeenCalledWith({
      applicationServerKey: new Uint8Array([0, 0, 0]),
      userVisibleOnly: true,
    });
    expect(refreshMock).toHaveBeenCalled();
    expect(
      await screen.findByText("이 브라우저에서 복습 알림을 받을 수 있습니다."),
    ).toBeInTheDocument();
  });

  it("unsubscribes this browser when the user clicks the unsubscribe button", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_PUBLIC_KEY);
    const existingSubscription = createPushSubscription();
    setupSupportedPushEnvironment({
      existingSubscription,
      permission: "granted",
    });
    checkPushSubscriptionOwnedActionMock.mockResolvedValue({ owned: true });
    unsubscribeFromPushActionMock.mockResolvedValue({ success: true });
    const PushSubscribeCard = await loadPushSubscribeCard();
    const user = userEvent.setup();

    render(<PushSubscribeCard initialHasAnySubscription={true} />);

    expect(
      await screen.findByText("현재 브라우저에서 알림이 켜져 있습니다."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /알림 끄기/ }));

    await waitFor(() => {
      expect(unsubscribeFromPushActionMock).toHaveBeenCalledWith(ENDPOINT);
    });
    expect(existingSubscription.unsubscribe).toHaveBeenCalled();
    const serverDeleteCallOrder =
      unsubscribeFromPushActionMock.mock.invocationCallOrder.at(0);
    const browserUnsubscribeCallOrder = vi
      .mocked(existingSubscription.unsubscribe)
      .mock.invocationCallOrder.at(0);

    if (
      serverDeleteCallOrder === undefined ||
      browserUnsubscribeCallOrder === undefined
    ) {
      throw new Error("Expected both unsubscribe steps to run");
    }

    expect(serverDeleteCallOrder).toBeLessThan(browserUnsubscribeCallOrder);
    expect(refreshMock).toHaveBeenCalled();
    expect(
      await screen.findByText("이 브라우저의 복습 알림을 껐습니다."),
    ).toBeInTheDocument();
  });
});
