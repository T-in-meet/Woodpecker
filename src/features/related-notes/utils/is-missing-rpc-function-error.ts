/** PostgREST가 RPC 함수를 schema cache에서 찾지 못했는지 확인합니다. */
export function isMissingRpcFunctionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  // v2가 아직 배포되지 않은 구 DB에서만 legacy RPC 폴백을 허용합니다.
  return error.code === "PGRST202";
}
