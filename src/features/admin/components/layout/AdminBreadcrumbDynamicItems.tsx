"use client";

import { useEffect } from "react";

import { useAdminBreadcrumb } from "../../contexts/AdminBreadcrumbContext";
import type { AdminBreadcrumbItem } from "../../types/breadcrumb";

interface AdminBreadcrumbDynamicItemsProps {
  /** 정적 Breadcrumb 뒤에 추가할 현재 페이지의 동적 항목 */
  items: readonly AdminBreadcrumbItem[];

  /** 동적 Breadcrumb 항목을 조회하고 있는지 여부 */
  loading?: boolean;
}

/**
 * 현재 페이지의 동적 Breadcrumb 항목과 로딩 상태를
 * 관리자 레이아웃에 등록합니다.
 *
 * 컴포넌트가 제거되면 이전 페이지의 항목과 로딩 상태가 남지 않도록
 * 등록했던 값을 초기화합니다.
 */
export function AdminBreadcrumbDynamicItems({
  items,
  loading = false,
}: AdminBreadcrumbDynamicItemsProps) {
  const { setDynamicItems, setIsDynamicItemsLoading } = useAdminBreadcrumb();

  useEffect(() => {
    setDynamicItems(items);
    setIsDynamicItemsLoading(loading);

    return () => {
      setDynamicItems([]);
      setIsDynamicItemsLoading(false);
    };
  }, [items, loading, setDynamicItems, setIsDynamicItemsLoading]);

  return null;
}
