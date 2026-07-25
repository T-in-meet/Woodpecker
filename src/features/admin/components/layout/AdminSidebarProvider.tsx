"use client";

import type { ComponentProps } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";

type AdminSidebarProviderProps = ComponentProps<typeof SidebarProvider>;

/**
 * 관리자 Sidebar의 상태와 레이아웃 Context를 제공합니다.
 *
 * 서버에서 전달받은 기본 펼침 상태를 사용하며,
 * 이후 상태 변경과 쿠키 저장은 SidebarProvider가 처리합니다.
 */
export function AdminSidebarProvider({
  children,
  ...props
}: AdminSidebarProviderProps) {
  return <SidebarProvider {...props}>{children}</SidebarProvider>;
}
