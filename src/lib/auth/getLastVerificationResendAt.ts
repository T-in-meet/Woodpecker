// TODO:
// 현재는 인메모리(Map) 기반으로 구현되어 있음
// 서버리스 / 멀티 인스턴스 환경에서는 상태가 공유되지 않아 정확하게 동작하지 않을 수 있음
// 프로덕션 환경에서는 Redis 등 외부 공유 저장소로 교체 필요

import { resendTimestampStore } from "./resendTimestampStore";

export async function getLastVerificationResendAt(
  email: string,
): Promise<number | null> {
  return resendTimestampStore.get(email) ?? null;
}
