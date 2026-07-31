"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";

import type { AdminBreadcrumbItem } from "../types/breadcrumb";

type AdminBreadcrumbContextValue = {
  /** 정적 Breadcrumb 뒤에 추가할 동적 항목 */
  dynamicItems: readonly AdminBreadcrumbItem[];

  /** 동적 Breadcrumb 항목을 조회하고 있는지 여부 */
  isDynamicItemsLoading: boolean;

  /** 로딩 중 표시할 동적 Breadcrumb Skeleton 항목 수 */
  dynamicLoadingItemCount: number;

  /** 동적 Breadcrumb 항목을 변경합니다. */
  setDynamicItems: Dispatch<SetStateAction<readonly AdminBreadcrumbItem[]>>;

  /** 동적 Breadcrumb 로딩 상태를 변경합니다. */
  setIsDynamicItemsLoading: Dispatch<SetStateAction<boolean>>;

  /** 로딩 중 표시할 동적 Breadcrumb Skeleton 항목 수를 변경합니다. */
  setDynamicLoadingItemCount: Dispatch<SetStateAction<number>>;
};

const AdminBreadcrumbContext =
  createContext<AdminBreadcrumbContextValue | null>(null);

type AdminBreadcrumbProviderProps = {
  children: ReactNode;
};

/**
 * 관리자 페이지의 동적 Breadcrumb 상태를 제공합니다.
 */
export function AdminBreadcrumbProvider({
  children,
}: AdminBreadcrumbProviderProps) {
  const [dynamicItems, setDynamicItems] = useState<
    readonly AdminBreadcrumbItem[]
  >([]);

  const [isDynamicItemsLoading, setIsDynamicItemsLoading] = useState(false);

  const [dynamicLoadingItemCount, setDynamicLoadingItemCount] = useState(0);

  const value = useMemo<AdminBreadcrumbContextValue>(
    () => ({
      dynamicItems,
      isDynamicItemsLoading,
      dynamicLoadingItemCount,
      setDynamicItems,
      setIsDynamicItemsLoading,
      setDynamicLoadingItemCount,
    }),
    [dynamicItems, isDynamicItemsLoading, dynamicLoadingItemCount],
  );

  return (
    <AdminBreadcrumbContext.Provider value={value}>
      {children}
    </AdminBreadcrumbContext.Provider>
  );
}

/**
 * 관리자 Breadcrumb Context를 반환합니다.
 *
 * Provider 외부에서 사용하면 오류를 발생시킵니다.
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
