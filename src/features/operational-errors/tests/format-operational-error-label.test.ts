import { describe, expect, it } from "vitest";

import {
  formatOperationalErrorCodeLabel,
  formatOperationalErrorFeatureLabel,
  formatOperationalErrorOperationLabel,
  formatOperationalErrorSeverityLabel,
  formatOperationalErrorStageLabel,
  formatOperationalErrorStatusLabel,
} from "@/features/operational-errors/utils/format-operational-error-label";

describe("formatOperationalErrorFeatureLabel", () => {
  it.each([
    ["admin_operational_errors", "운영 오류 관리"],
    ["notifications", "알림"],
  ])("%s에 대응하는 표시 이름을 반환한다", (feature, expected) => {
    expect(formatOperationalErrorFeatureLabel(feature)).toBe(expected);
  });

  it("등록되지 않은 기능 값은 원본 값을 반환한다", () => {
    expect(formatOperationalErrorFeatureLabel("unknown_feature")).toBe(
      "unknown_feature",
    );
  });
});

describe("formatOperationalErrorOperationLabel", () => {
  it.each([
    ["get_operational_error_detail", "운영 오류 상세 조회"],
    ["list_operational_errors", "운영 오류 목록 조회"],
    ["update_operational_error_status", "운영 오류 상태 변경"],
    ["create_user_notification", "사용자 알림 생성"],
    ["dispatch_push", "푸시 알림 전송"],
  ])("%s에 대응하는 표시 이름을 반환한다", (operation, expected) => {
    expect(formatOperationalErrorOperationLabel(operation)).toBe(expected);
  });

  it("등록되지 않은 작업 값은 원본 값을 반환한다", () => {
    expect(formatOperationalErrorOperationLabel("unknown_operation")).toBe(
      "unknown_operation",
    );
  });
});

describe("formatOperationalErrorStageLabel", () => {
  it.each([
    ["current_status_query", "현재 상태 조회"],
    ["detail_query", "상세 조회"],
    ["history_query", "처리 이력 조회"],
    ["list_query", "목록 조회"],
    ["profile_query", "사용자 정보 조회"],
    ["status_history_insert", "처리 이력 저장"],
    ["status_update", "상태 변경"],
    ["in_app_notification_create", "인앱 알림 생성"],
    ["push_send", "푸시 전송"],
    ["push_subscription_cleanup", "푸시 구독 정리"],
  ])("%s에 대응하는 표시 이름을 반환한다", (stage, expected) => {
    expect(formatOperationalErrorStageLabel(stage)).toBe(expected);
  });

  it("등록되지 않은 단계 값은 원본 값을 반환한다", () => {
    expect(formatOperationalErrorStageLabel("unknown_stage")).toBe(
      "unknown_stage",
    );
  });
});

describe("formatOperationalErrorCodeLabel", () => {
  it.each([
    ["OPERATIONAL_ERROR_DETAIL_FAILED", "운영 오류 상세 조회 실패"],
    ["OPERATIONAL_ERROR_HISTORY_FAILED", "운영 오류 처리 이력 조회 실패"],
    [
      "OPERATIONAL_ERROR_HISTORY_INSERT_FAILED",
      "운영 오류 처리 이력 저장 실패",
    ],
    ["OPERATIONAL_ERROR_LIST_FAILED", "운영 오류 목록 조회 실패"],
    ["OPERATIONAL_ERROR_PROFILES_FAILED", "운영 오류 사용자 정보 조회 실패"],
    ["OPERATIONAL_ERROR_STATUS_QUERY_FAILED", "운영 오류 현재 상태 조회 실패"],
    ["OPERATIONAL_ERROR_STATUS_UPDATE_FAILED", "운영 오류 상태 변경 실패"],
    ["NOTIFICATION_CREATE_FAILED", "사용자 알림 생성 실패"],
    ["PUSH_SEND_FAILED", "푸시 알림 전송 실패"],
    ["PUSH_SUBSCRIPTION_DELETE_FAILED", "푸시 구독 삭제 실패"],
    ["PUSH_SUBSCRIPTION_GONE", "만료된 푸시 구독 감지"],
  ])("%s에 대응하는 표시 이름을 반환한다", (errorCode, expected) => {
    expect(formatOperationalErrorCodeLabel(errorCode)).toBe(expected);
  });

  it("등록되지 않은 오류 코드는 원본 값을 반환한다", () => {
    expect(formatOperationalErrorCodeLabel("UNKNOWN_ERROR_CODE")).toBe(
      "UNKNOWN_ERROR_CODE",
    );
  });
});

describe("formatOperationalErrorStatusLabel", () => {
  it.each([
    ["OPEN", "미처리"],
    ["RESOLVED", "해결"],
    ["IGNORED", "무시"],
  ])("%s에 대응하는 표시 이름을 반환한다", (status, expected) => {
    expect(formatOperationalErrorStatusLabel(status)).toBe(expected);
  });

  it("등록되지 않은 상태 값은 원본 값을 반환한다", () => {
    expect(formatOperationalErrorStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("formatOperationalErrorSeverityLabel", () => {
  it.each([
    ["INFO", "정보"],
    ["WARN", "경고"],
    ["ERROR", "오류"],
  ])("%s에 대응하는 표시 이름을 반환한다", (severity, expected) => {
    expect(formatOperationalErrorSeverityLabel(severity)).toBe(expected);
  });

  it("등록되지 않은 심각도 값은 원본 값을 반환한다", () => {
    expect(formatOperationalErrorSeverityLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});
