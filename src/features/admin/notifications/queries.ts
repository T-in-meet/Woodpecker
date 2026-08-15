"use server";

import type { NotificationListItemType } from "@/features/notifications/schema";

import { requireAdmin } from "../utils/require-admin";
import {
  type AdminUnreadNotificationCounts,
  getAdminNotificationListFor,
  getAdminUnreadNotificationCountsFor,
} from "./queries.internal";

export type GetAdminNotificationListOptions = {
  /** 반환할 최대 알림 개수 */
  limit?: number;
};

/**
 * 현재 관리자 기준으로 읽지 않은 관리자 알림 개수를 타입별로 조회합니다.
 *
 * 이 Server Action은 클라이언트에서 호출될 수 있으므로 항상 requireAdmin()을
 * 실행해 관리자 ID를 결정합니다.
 *
 * @returns 1개 이상 읽지 않은 알림이 있는 타입만 담은 count map
 */
export async function getAdminUnreadNotificationCounts(): Promise<AdminUnreadNotificationCounts> {
  const adminUserId = await requireAdmin();

  return getAdminUnreadNotificationCountsFor(adminUserId);
}

/**
 * 현재 관리자 기준 읽지 않은 관리자 알림 이벤트 목록을 조회합니다.
 *
 * 이 Server Action은 클라이언트에서 호출될 수 있으므로 호출자가 관리자 ID를
 * 주입할 수 없게 하고, 내부에서 항상 requireAdmin()을 실행합니다.
 *
 * @param options 조회할 최대 알림 개수
 * @returns 읽지 않은 관리자 알림 목록
 */
export async function getAdminNotificationList(
  options: GetAdminNotificationListOptions = {},
): Promise<NotificationListItemType[]> {
  const adminUserId = await requireAdmin();

  return getAdminNotificationListFor(adminUserId, options);
}
