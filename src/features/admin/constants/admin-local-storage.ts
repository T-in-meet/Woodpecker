/**
 * 관리자 페이지 설정을 저장하는 localStorage 키입니다.
 *
 * 관리자 페이지와 관련된 모든 브라우저 설정은
 * 이 키의 객체 내부에서 통합 관리합니다.
 */
export const ADMIN_LOCAL_STORAGE_KEY = "woodpecker-admin";

/**
 * 관리자 페이지에서 localStorage에 저장하는 설정입니다.
 *
 * 각 필드는 이전 버전의 저장값이나 신규 사용자 환경을 고려하여
 * 선택 속성으로 정의합니다.
 */
export interface AdminLocalStorageData {
  /** 관리자 Sidebar의 펼침 상태 */
  sidebarOpen?: boolean;
}
