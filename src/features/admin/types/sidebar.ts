import type { LucideIcon } from "lucide-react";

export interface AdminSidebarItem {
  title: string;

  href?: string;

  icon: LucideIcon;

  badge?: string;

  children?: AdminSidebarItem[];

  // Breadcrumb에서 표시할 라벨 (미지정 시 title 사용)
  breadcrumbLabel?: string;
}
