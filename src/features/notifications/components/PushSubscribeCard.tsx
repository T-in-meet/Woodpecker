"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  checkPushSubscriptionOwnedAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "../actions";

type PushSubscriptionPayloadType = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type PushSubscribeCardProps = {
  initialHasAnySubscription: boolean;
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const isServiceWorkerRuntimeEnabled =
  process.env.NODE_ENV !== "development" ||
  process.env.NEXT_PUBLIC_ENABLE_SW === "true";

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function serializePushSubscription(
  subscription: PushSubscription,
): PushSubscriptionPayloadType {
  const json = subscription.toJSON();
  const { endpoint, keys } = json;

  if (!endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error("브라우저 구독 정보를 읽을 수 없습니다.");
  }

  return {
    endpoint,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
}

async function getReadyServiceWorkerRegistration() {
  const currentRegistration = await navigator.serviceWorker.getRegistration();

  if (!currentRegistration) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  return await navigator.serviceWorker.ready;
}

async function getCurrentPushSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

function getFallbackErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "알림 설정을 변경하지 못했습니다.";
}

export function PushSubscribeCard({
  initialHasAnySubscription,
}: PushSubscribeCardProps) {
  const router = useRouter();
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(true);
  const [browserEndpoint, setBrowserEndpoint] = useState<string | null>(null);
  const [isOwnedByCurrentUser, setIsOwnedByCurrentUser] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isRuntimeEnabled =
    isServiceWorkerRuntimeEnabled && vapidPublicKey.length > 0;
  // Push endpoint is origin-scoped, so a stale browser subscription left by a previous account
  // does NOT mean the current user owns it. Verify ownership against the DB before treating
  // the button as "unsubscribe".
  const isCurrentBrowserSubscribed =
    permission === "granted" &&
    browserEndpoint !== null &&
    isOwnedByCurrentUser;
  const hasOrphanBrowserSubscription =
    permission === "granted" &&
    browserEndpoint !== null &&
    !isOwnedByCurrentUser;

  useEffect(() => {
    let isCancelled = false;

    async function checkSubscription() {
      if (!isPushSupported()) {
        if (!isCancelled) {
          setIsSupported(false);
          setIsChecking(false);
        }
        return;
      }

      setPermission(Notification.permission);

      if (!isRuntimeEnabled) {
        if (!isCancelled) setIsChecking(false);
        return;
      }

      try {
        const subscription = await getCurrentPushSubscription();

        if (isCancelled) return;

        const endpoint = subscription?.endpoint ?? null;
        setBrowserEndpoint(endpoint);

        if (endpoint) {
          const { owned } = await checkPushSubscriptionOwnedAction(endpoint);
          if (!isCancelled) setIsOwnedByCurrentUser(owned);
        } else {
          setIsOwnedByCurrentUser(false);
        }
      } catch (checkError) {
        if (!isCancelled) {
          console.error("푸시 알림 상태를 확인하지 못했습니다.", checkError);
        }
      } finally {
        if (!isCancelled) {
          setIsChecking(false);
        }
      }
    }

    void checkSubscription();

    return () => {
      isCancelled = true;
    };
  }, [isRuntimeEnabled]);

  const disabledReason = !isSupported
    ? "이 브라우저는 푸시 알림을 지원하지 않습니다."
    : !isServiceWorkerRuntimeEnabled
      ? "개발 서버에서 서비스 워커가 비활성화되어 있습니다. 로컬 알림 검증은 npm run dev:sw로 실행해주세요."
      : vapidPublicKey.length === 0
        ? "VAPID 공개 키가 설정되지 않았습니다."
        : permission === "denied"
          ? "브라우저 사이트 설정에서 알림을 허용해 주세요."
          : null;

  const handleSubscribe = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const nextPermission =
          Notification.permission === "granted"
            ? "granted"
            : await Notification.requestPermission();

        setPermission(nextPermission);

        if (nextPermission !== "granted") {
          setError("알림 권한이 허용되지 않았습니다.");
          return;
        }

        const registration = await getReadyServiceWorkerRegistration();
        const existingSubscription =
          await registration.pushManager.getSubscription();

        if (existingSubscription && !isOwnedByCurrentUser) {
          await existingSubscription.unsubscribe();
          setBrowserEndpoint(null);
        }

        const subscription =
          (isOwnedByCurrentUser ? existingSubscription : null) ??
          (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));
        const payload = serializePushSubscription(subscription);
        const result = await subscribeToPushAction(payload);

        if (!result.success) {
          setError(result.error);
          return;
        }

        setBrowserEndpoint(payload.endpoint);
        setIsOwnedByCurrentUser(true);
        setMessage("이 브라우저에서 복습 알림을 받을 수 있습니다.");
        router.refresh();
      } catch (subscribeError) {
        setError(getFallbackErrorMessage(subscribeError));
      }
    });
  };

  const handleUnsubscribe = () => {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const subscription = await getCurrentPushSubscription();
        const endpoint = subscription?.endpoint ?? browserEndpoint;

        if (!endpoint) {
          setBrowserEndpoint(null);
          return;
        }

        const result = await unsubscribeFromPushAction(endpoint);

        if (!result.success) {
          setError(result.error);
          return;
        }

        if (subscription) {
          await subscription.unsubscribe();
        }

        setBrowserEndpoint(null);
        setIsOwnedByCurrentUser(false);
        setMessage("이 브라우저의 복습 알림을 껐습니다.");
        router.refresh();
      } catch (unsubscribeError) {
        setError(getFallbackErrorMessage(unsubscribeError));
      }
    });
  };

  const statusText = isChecking
    ? "알림 상태를 확인하는 중입니다."
    : disabledReason
      ? disabledReason
      : isCurrentBrowserSubscribed
        ? "현재 브라우저에서 알림이 켜져 있습니다."
        : hasOrphanBrowserSubscription
          ? "이 브라우저에 다른 계정의 구독이 남아있습니다. 알림 켜기를 누르면 새 구독으로 다시 설정합니다."
          : initialHasAnySubscription
            ? "다른 브라우저에 저장된 알림 구독이 있습니다."
            : "현재 브라우저에서 알림이 꺼져 있습니다.";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>복습 알림</CardTitle>
          {isCurrentBrowserSubscribed ? (
            <Bell className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <BellOff
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-1">
          <p className="text-sm font-medium">{statusText}</p>
          <p className="text-xs text-muted-foreground">
            복습 예정 시간이 되면 이 브라우저로 알림을 보냅니다.
          </p>
        </div>

        <Button
          type="button"
          variant={isCurrentBrowserSubscribed ? "outline" : "default"}
          size="md"
          disabled={isPending || isChecking || disabledReason !== null}
          onClick={
            isCurrentBrowserSubscribed ? handleUnsubscribe : handleSubscribe
          }
        >
          {isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : isCurrentBrowserSubscribed ? (
            <BellOff aria-hidden="true" />
          ) : (
            <Bell aria-hidden="true" />
          )}
          {isPending
            ? "처리 중"
            : isCurrentBrowserSubscribed
              ? "알림 끄기"
              : "알림 켜기"}
        </Button>

        <div aria-live="polite" className="min-h-5">
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
