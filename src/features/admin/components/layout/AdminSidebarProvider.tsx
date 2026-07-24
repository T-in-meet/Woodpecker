"use client";

import type { ComponentProps } from "react";
import { useEffect, useState } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import {
  ADMIN_SIDEBAR_DEFAULT_OPEN,
  ADMIN_SIDEBAR_OPEN_STORAGE_KEY,
} from "@/features/admin/constants/admin-sidebar";

type AdminSidebarProviderProps = Omit<
  ComponentProps<typeof SidebarProvider>,
  "open" | "onOpenChange"
>;

/**
 * 관리자 Sidebar의 펼침 상태를 관리하는 Provider입니다.
 *
 * localStorage의 상태를 복원한 이후에만 SidebarProvider를 렌더링하여
 * 새로고침 시 기본 상태가 잠깐 노출되는 현상을 방지합니다.
 */
export function AdminSidebarProvider({
  children,
  ...props
}: AdminSidebarProviderProps) {
  const [open, setOpen] = useState<boolean | null>(null);

  /**
   * 클라이언트 마운트 이후 저장된 Sidebar 상태를 복원합니다.
   *
   * 저장된 값이 없으면 관리자 Sidebar의 기본 상태를 사용합니다.
   */
  useEffect(() => {
    const storedOpen = localStorage.getItem(ADMIN_SIDEBAR_OPEN_STORAGE_KEY);

    if (storedOpen === null) {
      setOpen(ADMIN_SIDEBAR_DEFAULT_OPEN);
      return;
    }

    setOpen(storedOpen === "true");
  }, []);

  /**
   * Sidebar 상태를 변경하고 localStorage에 저장합니다.
   *
   * @param nextOpen 변경할 Sidebar 펼침 상태
   */
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    localStorage.setItem(ADMIN_SIDEBAR_OPEN_STORAGE_KEY, String(nextOpen));
  }

  /**
   * 저장 상태를 복원하기 전에는 Sidebar 레이아웃을 렌더링하지 않습니다.
   */
  if (open === null) {
    return <div className={props.className} aria-hidden="true" />;
  }

  return (
    <SidebarProvider {...props} open={open} onOpenChange={handleOpenChange}>
      {children}
    </SidebarProvider>
  );
}
