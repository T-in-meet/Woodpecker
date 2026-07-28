/**
 * 운영 오류의 처리 상태입니다.
 *
 * OPEN: 아직 확인되지 않은 오류
 * RESOLVED: 원인을 확인하고 해결한 오류
 * IGNORED: 확인했지만 별도 조치가 필요하지 않은 오류
 */
export const OPERATIONAL_ERROR_STATUS = {
  IGNORED: "IGNORED",
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
} as const;

/**
 * 운영 오류의 심각도입니다.
 */
export const OPERATIONAL_ERROR_SEVERITY = {
  ERROR: "ERROR",
  INFO: "INFO",
  WARN: "WARN",
} as const;

/**
 * 운영 오류의 처리 상태 타입입니다.
 */
export type OperationalErrorStatusType =
  (typeof OPERATIONAL_ERROR_STATUS)[keyof typeof OPERATIONAL_ERROR_STATUS];

/**
 * 운영 오류의 심각도 타입입니다.
 */
export type OperationalErrorSeverityType =
  (typeof OPERATIONAL_ERROR_SEVERITY)[keyof typeof OPERATIONAL_ERROR_SEVERITY];
