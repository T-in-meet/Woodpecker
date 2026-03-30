// TODO: DB(또는 캐시)에서 마지막 재전송 시각 조회 구현 필요
export async function getLastVerificationResendAt(
  _email: string,
): Promise<number | null> {
  throw new Error("Not implemented");
}
