import {
  OPERATIONAL_ERROR_CODE_LABELS,
  OPERATIONAL_ERROR_FEATURE_LABELS,
  OPERATIONAL_ERROR_OPERATION_LABELS,
  OPERATIONAL_ERROR_SEVERITY_LABELS,
  OPERATIONAL_ERROR_STAGE_LABELS,
  OPERATIONAL_ERROR_STATUS_LABELS,
} from "@/features/operational-errors/constants";

/**
 * 주어진 값에 대응하는 표시 이름을 반환합니다.
 *
 * 아직 등록되지 않은 값은 원본 값을 반환하여 화면에 빈 값이
 * 표시되지 않도록 합니다.
 */
function getLabel(
  labels: Readonly<Record<string, string>>,
  value: string,
): string {
  return labels[value] ?? value;
}

/**
 * 운영 오류 기능의 표시 이름을 반환합니다.
 */
export function formatOperationalErrorFeatureLabel(feature: string): string {
  return getLabel(OPERATIONAL_ERROR_FEATURE_LABELS, feature);
}

/**
 * 운영 오류 작업의 표시 이름을 반환합니다.
 */
export function formatOperationalErrorOperationLabel(
  operation: string,
): string {
  return getLabel(OPERATIONAL_ERROR_OPERATION_LABELS, operation);
}

/**
 * 운영 오류 작업 단계의 표시 이름을 반환합니다.
 */
export function formatOperationalErrorStageLabel(stage: string): string {
  return getLabel(OPERATIONAL_ERROR_STAGE_LABELS, stage);
}

/**
 * 운영 오류 코드의 표시 이름을 반환합니다.
 */
export function formatOperationalErrorCodeLabel(errorCode: string): string {
  return getLabel(OPERATIONAL_ERROR_CODE_LABELS, errorCode);
}

/**
 * 운영 오류 처리 상태의 표시 이름을 반환합니다.
 */
export function formatOperationalErrorStatusLabel(status: string): string {
  return getLabel(OPERATIONAL_ERROR_STATUS_LABELS, status);
}

/**
 * 운영 오류 심각도의 표시 이름을 반환합니다.
 */
export function formatOperationalErrorSeverityLabel(severity: string): string {
  return getLabel(OPERATIONAL_ERROR_SEVERITY_LABELS, severity);
}
