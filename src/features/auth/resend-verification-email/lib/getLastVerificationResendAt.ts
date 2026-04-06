// TODO:
// 현재는 인메모리(Map) 기반으로 구현되어 있음
// 서버리스 / 멀티 인스턴스 환경에서는 상태가 공유되지 않아 정확하게 동작하지 않을 수 있음
// 프로덕션 환경에서는 Redis 등 외부 공유 저장소로 교체 필요

import { resendTimestampStore } from "./resendTimestampStore";

/**
 * 특정 이메일의 마지막 인증 메일 재전송 시각 조회
 *
 * @param email 조회할 이메일
 * @returns
 *  - number: 마지막 재전송 시각 (timestamp, ms)
 *  - null: 재전송 이력이 없는 경우
 *
 * 사용 목적:
 * - 재전송 cooldown 체크 (예: 60초 내 재요청 방지)
 * - 클라이언트 UI에서 남은 시간 계산 등에 활용
 */
export async function getLastVerificationResendAt(
  email: string,
): Promise<number | null> {
  /**
   * Map에서 이메일 기준으로 timestamp 조회
   * - 값이 없으면 undefined → null로 변환하여 반환
   */
  return resendTimestampStore.get(email) ?? null;
}
