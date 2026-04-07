/**
 * 이메일 인증 재전송 시각 저장소 (in-memory)
 *
 * key: email
 * value: 마지막 재전송 시각 (timestamp, ms)
 *
 * 사용 목적:
 * - resend cooldown 관리 (예: 60초 제한)
 * - 마지막 요청 시점을 기준으로 재요청 가능 여부 판단
 *
 * ⚠️ 주의사항
 * - 서버 메모리에 저장되므로 서버리스/멀티 인스턴스 환경에서 상태 공유 불가
 * - 인스턴스가 재시작되면 데이터가 초기화됨
 * - 프로덕션에서는 Redis 등 외부 저장소로 대체 필요
 */
export const resendTimestampStore = new Map<string, number>();
