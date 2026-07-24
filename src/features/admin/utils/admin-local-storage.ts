import {
  ADMIN_LOCAL_STORAGE_KEY,
  type AdminLocalStorageData,
} from "@/features/admin/constants/admin-local-storage";

/**
 * 현재 환경에서 localStorage를 사용할 수 있는지 확인합니다.
 *
 * Next.js 서버 렌더링 환경에서는 window가 존재하지 않으므로
 * localStorage 접근 전에 사용 가능 여부를 검사합니다.
 *
 * @returns localStorage를 사용할 수 있으면 true
 */
function canUseAdminLocalStorage(): boolean {
  return typeof window !== "undefined";
}

/**
 * 관리자 페이지의 전체 localStorage 설정을 조회합니다.
 *
 * 저장된 값이 없거나 JSON 형식이 올바르지 않으면
 * 빈 설정 객체를 반환합니다.
 *
 * @returns 관리자 페이지에 저장된 전체 설정
 */
export function getAdminLocalStorage(): AdminLocalStorageData {
  if (!canUseAdminLocalStorage()) {
    return {};
  }

  const storedValue = window.localStorage.getItem(ADMIN_LOCAL_STORAGE_KEY);

  if (storedValue === null) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(storedValue);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      Array.isArray(parsedValue)
    ) {
      return {};
    }

    return parsedValue as AdminLocalStorageData;
  } catch {
    return {};
  }
}

/**
 * 관리자 페이지의 특정 localStorage 설정값을 조회합니다.
 *
 * @template TKey 조회할 관리자 설정 필드
 * @param key 조회할 설정 필드
 * @returns 저장된 설정값 또는 undefined
 */
export function getAdminLocalStorageItem<
  TKey extends keyof AdminLocalStorageData,
>(key: TKey): AdminLocalStorageData[TKey] {
  const data = getAdminLocalStorage();

  return data[key];
}

/**
 * 관리자 페이지의 특정 localStorage 설정값을 저장합니다.
 *
 * 기존 관리자 설정을 유지한 상태에서 전달받은 필드만 변경합니다.
 *
 * @template TKey 저장할 관리자 설정 필드
 * @param key 저장할 설정 필드
 * @param value 저장할 설정값
 */
export function setAdminLocalStorageItem<
  TKey extends keyof AdminLocalStorageData,
>(key: TKey, value: AdminLocalStorageData[TKey]): void {
  if (!canUseAdminLocalStorage()) {
    return;
  }

  const currentData = getAdminLocalStorage();

  const nextData: AdminLocalStorageData = {
    ...currentData,
    [key]: value,
  };

  window.localStorage.setItem(
    ADMIN_LOCAL_STORAGE_KEY,
    JSON.stringify(nextData),
  );
}

/**
 * 관리자 페이지의 특정 localStorage 설정값을 제거합니다.
 *
 * 다른 관리자 설정은 유지하며 지정한 필드만 제거합니다.
 *
 * @param key 제거할 설정 필드
 */
export function removeAdminLocalStorageItem(
  key: keyof AdminLocalStorageData,
): void {
  if (!canUseAdminLocalStorage()) {
    return;
  }

  const currentData = getAdminLocalStorage();
  const nextData = { ...currentData };

  delete nextData[key];

  window.localStorage.setItem(
    ADMIN_LOCAL_STORAGE_KEY,
    JSON.stringify(nextData),
  );
}

/**
 * 관리자 페이지의 모든 localStorage 설정을 제거합니다.
 */
export function clearAdminLocalStorage(): void {
  if (!canUseAdminLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(ADMIN_LOCAL_STORAGE_KEY);
}
