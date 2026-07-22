import type { LucideIcon } from "lucide-react";

export interface AdminSidebarItem {
  title: string;

  href?: string;

  icon: LucideIcon;

  breadcrumbLabel?: string;

  breadcrumbHref?: string;

  children?: readonly AdminSidebarItem[];
}
