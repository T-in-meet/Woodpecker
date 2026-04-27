import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const ENDPOINT = "https://push.example.test/subscription-id";
const VAPID_PUBLIC_KEY = "AAAA";

const {
  refreshMock,
  subscribeToPushActionMock,
  unsubscribeFromPushActionMock,
} = vi.hoisted(() => ({
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
  const mod = await import("./PushSubscribeCard");
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
}: SupportedPushEnvironmentOptionsType = {}) {
  const requestPermissionMock = vi.fn().mockResolvedValue("granted");
  const notificationMock = {
    permission,
    requestPermission: requestPermissionMock,
  };
  const getSubscriptionMock = vi.fn().mockResolvedValue(existingSubscription);
  const subscribedSubscription = createPushSubscription();
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
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
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

  it("does not auto-resubscribe an existing browser subscription", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_PUBLIC_KEY);
    setupSupportedPushEnvironment({
      existingSubscription: createPushSubscription(),
      permission: "granted",
    });
    const PushSubscribeCard = await loadPushSubscribeCard();

    render(<PushSubscribeCard initialHasAnySubscription={true} />);

    expect(
      await screen.findByText("현재 브라우저에서 알림이 켜져 있습니다."),
    ).toBeInTheDocument();
    expect(subscribeToPushActionMock).not.toHaveBeenCalled();
  });

  it("subscribes this browser when the user clicks the subscribe button", async () => {
    vi.stubEnv("NODE_ENV", "production");
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
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_PUBLIC_KEY);
    const existingSubscription = createPushSubscription();
    setupSupportedPushEnvironment({
      existingSubscription,
      permission: "granted",
    });
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
    expect(refreshMock).toHaveBeenCalled();
    expect(
      await screen.findByText("이 브라우저의 복습 알림을 껐습니다."),
    ).toBeInTheDocument();
  });
});
