"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import type { AdminBreadcrumbItem } from "../types/breadcrumb";

interface AdminBreadcrumbContextValue {
  /** 현재 페이지가 정적 Breadcrumb 뒤에 추가할 동적 항목 */
  dynamicItems: readonly AdminBreadcrumbItem[];

  /** 현재 페이지의 동적 Breadcrumb 항목을 변경합니다. */
  setDynamicItems: (items: readonly AdminBreadcrumbItem[]) => void;
}

interface AdminBreadcrumbProviderProps {
  /** 관리자 Breadcrumb 상태를 공유할 하위 영역 */
  children: ReactNode;
}

const AdminBreadcrumbContext =
  createContext<AdminBreadcrumbContextValue | null>(null);

/**
 * 관리자 페이지에서 동적으로 추가되는 Breadcrumb 항목을 관리합니다.
 *
 * 사이드바 설정을 기반으로 생성되는 정적 Breadcrumb과 별개로,
 * 상세 페이지에서 조회한 데이터의 이름과 이동 경로를 저장합니다.
 */
export function AdminBreadcrumbProvider({
  children,
}: AdminBreadcrumbProviderProps) {
  const [dynamicItems, setDynamicItemsState] = useState<
    readonly AdminBreadcrumbItem[]
  >([]);

  const setDynamicItems = useCallback(
    (items: readonly AdminBreadcrumbItem[]) => {
      setDynamicItemsState(items);
    },
    [],
  );

  const value = useMemo(
    () => ({
      dynamicItems,
      setDynamicItems,
    }),
    [dynamicItems, setDynamicItems],
  );

  return (
    <AdminBreadcrumbContext.Provider value={value}>
      {children}
    </AdminBreadcrumbContext.Provider>
  );
}

/**
 * 관리자 페이지의 동적 Breadcrumb 상태를 반환합니다.
 *
 * @throws AdminBreadcrumbProvider 외부에서 호출한 경우
 */
export function useAdminBreadcrumb() {
  const context = useContext(AdminBreadcrumbContext);

  if (!context) {
    throw new Error(
      "useAdminBreadcrumb must be used within AdminBreadcrumbProvider.",
    );
  }

  return context;
}
