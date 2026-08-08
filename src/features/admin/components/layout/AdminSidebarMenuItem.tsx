"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

import type {
  AdminSidebarBadgeMap,
  AdminSidebarItem,
} from "../../types/sidebar";
import {
  formatSidebarBadgeCount,
  getItemKey,
  getSidebarBadgeCount,
  hasActiveItem,
  isPathActive,
  type OpenGroups,
} from "../../utils/admin-sidebar";

type AdminSidebarMenuItemProps = {
  item: AdminSidebarItem;

  badgeMap?: AdminSidebarBadgeMap | undefined;

  pathname: string;

  openGroups: OpenGroups;

  onOpenChange: (depth: number, itemKey: string, open: boolean) => void;

  onNavigate: () => void;

  depth?: number;
};

export function AdminSidebarMenuItem({
  item,
  badgeMap,
  pathname,
  openGroups,
  onOpenChange,
  onNavigate,
  depth = 0,
}: AdminSidebarMenuItemProps) {
  const children = item.children;
  const hasChildren = Boolean(children?.length);

  const isActive = isPathActive(pathname, item.href);
  const containsActiveItem = hasActiveItem(pathname, item);

  const itemKey = getItemKey(item, depth);
  const isOpen = openGroups[depth] === itemKey;

  const Icon = item.icon;

  const chevronRotation = isOpen ? "rotate-90" : "rotate-0";
  const badgeCount = getSidebarBadgeCount(item, badgeMap);
  const badgeLabel = formatSidebarBadgeCount(badgeCount);

  const badge = badgeLabel ? (
    <span
      aria-label={`${badgeCount}개의 읽지 않은 관리자 알림`}
      className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sidebar-primary px-1.5 text-[11px] font-medium leading-none text-sidebar-primary-foreground tabular-nums group-data-[collapsible=icon]:hidden"
    >
      {badgeLabel}
    </span>
  ) : null;

  if (!hasChildren) {
    if (!item.href) {
      return null;
    }

    if (depth === 0) {
      return (
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
            <Link href={item.href} onClick={onNavigate}>
              <Icon />

              <span className="min-w-0 flex-1 truncate">{item.title}</span>

              {badge}
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <Link href={item.href} onClick={onNavigate}>
            <Icon />

            <span className="min-w-0 flex-1 truncate">{item.title}</span>

            {badge}
          </Link>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  }

  if (!children) {
    return null;
  }

  if (depth === 0) {
    return (
      <Collapsible
        asChild
        open={isOpen}
        onOpenChange={(open) => {
          onOpenChange(depth, itemKey, open);
        }}
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              isActive={containsActiveItem}
              tooltip={item.title}
            >
              <Icon />

              <span className="min-w-0 flex-1 truncate">{item.title}</span>

              {badge}

              <ChevronRight
                className={`shrink-0 transition-transform duration-200 ${chevronRotation}`}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => (
                <AdminSidebarMenuItem
                  key={getItemKey(child, depth + 1)}
                  badgeMap={badgeMap}
                  item={child}
                  pathname={pathname}
                  openGroups={openGroups}
                  onOpenChange={onOpenChange}
                  onNavigate={onNavigate}
                  depth={depth + 1}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <Collapsible
      asChild
      open={isOpen}
      onOpenChange={(open) => {
        onOpenChange(depth, itemKey, open);
      }}
    >
      <SidebarMenuSubItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton isActive={containsActiveItem}>
            <Icon />

            <span className="min-w-0 flex-1 truncate">{item.title}</span>

            {badge}

            <ChevronRight
              className={`shrink-0 transition-transform duration-200 ${chevronRotation}`}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <AdminSidebarMenuItem
                key={getItemKey(child, depth + 1)}
                badgeMap={badgeMap}
                item={child}
                pathname={pathname}
                openGroups={openGroups}
                onOpenChange={onOpenChange}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
