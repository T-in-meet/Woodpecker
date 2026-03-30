// TODO: DB(또는 캐시)에 마지막 재전송 시각 저장 구현 필요
export async function setLastVerificationResendAt(
  _email: string,
  _timestamp: number,
): Promise<void> {
  throw new Error("Not implemented");
}
