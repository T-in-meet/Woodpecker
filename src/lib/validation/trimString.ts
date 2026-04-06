// Boundary helper
// 문자열 입력에 대해서만 trim 적용 (API/Form 입력 정규화용)
export function trimIfString(val: unknown): unknown {
  return typeof val === "string" ? val.trim() : val;
}
