/**
 * FormData에서 boolean 값을 읽습니다.
 *
 * @param formData 입력 FormData
 * @param key 읽을 필드 이름
 * @returns 체크 여부
 */
export function readFormBoolean(formData: FormData, key: string) {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

/**
 * FormData에서 문자열 값을 읽습니다.
 *
 * @param formData 입력 FormData
 * @param key 읽을 필드 이름
 * @returns 문자열 값
 */
export function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}
