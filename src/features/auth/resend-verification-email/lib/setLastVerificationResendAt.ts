// TODO:
// 현재는 인메모리(Map) 기반으로 구현되어 있음
// 서버리스 / 멀티 인스턴스 환경에서는 상태가 공유되지 않아 정확하게 동작하지 않을 수 있음
// 프로덕션 환경에서는 Redis 등 외부 공유 저장소로 교체 필요

import { resendTimestampStore } from "./resendTimestampStore";

/**
 * 이메일 인증 재전송 시각 저장
 *
 * @param email 대상 이메일
 * @param timestamp 저장할 시각 (ms 단위 timestamp)
 *
 * 사용 목적:
 * - 마지막 재전송 시각을 기록하여 cooldown 계산에 활용
 * - 이후 getLastVerificationResendAt에서 조회됨
 */
export async function setLastVerificationResendAt(
  email: string,
  timestamp: number,
): Promise<void> {
  /**
   * Map에 이메일 기준으로 timestamp 저장
   */
  resendTimestampStore.set(email, timestamp);
}
