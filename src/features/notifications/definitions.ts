import { buildNotesUrl } from "@/features/notes/utils/buildNotesUrl";
import {
  ADMIN_NOTIFICATION_TYPES,
  type AdminNotificationKindType,
  NOTIFICATION_TYPES,
  type NotificationKindType,
} from "@/lib/constants/notifications";
import {
  getAdminFeedbackDetailRoute,
  getAdminOperationalErrorDetailRoute,
  ROUTES,
} from "@/lib/constants/routes";
import type { Json } from "@/types/db.helpers";

type NotificationDefinition = {
  defaultClickPath: string;
  icon: string;
  label: string;
  pushEnabled: boolean;
};

type BuildFeedbackReplyDefinitionInput = {
  feedbackId: string;
};

type BuildAdminFeedbackCreatedDefinitionInput = {
  feedbackId: string;
};

type BuildAdminOperationalErrorDefinitionInput = {
  operationalErrorId: string;
};

export type NotificationMetadata = Record<string, Json>;

/**
 * 알림 타입별 기본 표현과 전송 정책을 한 곳에서 관리합니다.
 *
 * 실제 클릭 경로는 대부분 엔티티 ID가 필요하므로 아래 build* 함수에서
 * 기본 정의를 확장해 생성합니다.
 */
export const USER_NOTIFICATION_DEFINITIONS = {
  [NOTIFICATION_TYPES.FEEDBACK_REPLY]: {
    defaultClickPath: ROUTES.MYPAGE,
    icon: "message-circle-reply",
    label: "피드백 답변",
    pushEnabled: true,
  },
  [NOTIFICATION_TYPES.REVIEW]: {
    defaultClickPath: buildNotesUrl({ view: "due" }),
    icon: "bell",
    label: "복습",
    pushEnabled: true,
  },
  [NOTIFICATION_TYPES.SYSTEM]: {
    defaultClickPath: ROUTES.HOME,
    icon: "info",
    label: "시스템",
    pushEnabled: false,
  },
} satisfies Record<NotificationKindType, NotificationDefinition>;

/**
 * 관리자 알림은 사용자 알림과 달리 공용 이벤트를 한 번만 만들고,
 * 읽음 상태는 관리자별로 별도 테이블에서 관리합니다.
 */
export const ADMIN_NOTIFICATION_DEFINITIONS = {
  [ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED]: {
    defaultClickPath: ROUTES.ADMIN.FEEDBACKS,
    icon: "message-square-text",
    label: "사용자 피드백",
    pushEnabled: true,
  },
  [ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR]: {
    defaultClickPath: ROUTES.ADMIN.OPERATIONAL_ERRORS,
    icon: "flask-conical",
    label: "운영 오류",
    pushEnabled: true,
  },
} satisfies Record<AdminNotificationKindType, NotificationDefinition>;

/**
 * 피드백 답변 알림의 클릭 경로와 표현 정의를 생성합니다.
 *
 * @param feedbackId 답변이 달린 feedbacks.id
 * @returns 피드백 답변 사용자 알림 정의
 */
export function buildFeedbackReplyNotificationDefinition({
  feedbackId: _feedbackId,
}: BuildFeedbackReplyDefinitionInput) {
  return {
    ...USER_NOTIFICATION_DEFINITIONS[NOTIFICATION_TYPES.FEEDBACK_REPLY],
    clickPath: `${ROUTES.MYPAGE}?section=support&tab=inquiry`,
  };
}

/**
 * 새 피드백 관리자 알림의 클릭 경로와 표현 정의를 생성합니다.
 *
 * @param feedbackId 새로 생성된 feedbacks.id
 * @returns 새 피드백 관리자 알림 정의
 */
export function buildAdminFeedbackCreatedNotificationDefinition({
  feedbackId,
}: BuildAdminFeedbackCreatedDefinitionInput) {
  return {
    ...ADMIN_NOTIFICATION_DEFINITIONS[
      ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED
    ],
    clickPath: getAdminFeedbackDetailRoute(feedbackId),
  };
}

/**
 * 운영 오류 관리자 알림의 클릭 경로와 표현 정의를 생성합니다.
 *
 * @param operationalErrorId 운영 오류 ID
 * @returns 운영 오류 관리자 알림 정의
 */
export function buildAdminOperationalErrorNotificationDefinition({
  operationalErrorId,
}: BuildAdminOperationalErrorDefinitionInput) {
  return {
    ...ADMIN_NOTIFICATION_DEFINITIONS[
      ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR
    ],
    clickPath: getAdminOperationalErrorDetailRoute(operationalErrorId),
  };
}
