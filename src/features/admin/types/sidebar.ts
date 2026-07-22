import type { LucideIcon } from "lucide-react";

export interface AdminSidebarItem {
  title: string;

  href?: string;

  icon: LucideIcon;

  badge?: string;

  children?: AdminSidebarItem[];
}
