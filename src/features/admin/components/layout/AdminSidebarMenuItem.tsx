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

import type { AdminSidebarItem } from "../../types/sidebar";
import {
  getItemKey,
  hasActiveItem,
  isPathActive,
  type OpenGroups,
} from "../../utils/admin-sidebar";

interface AdminSidebarMenuItemProps {
  item: AdminSidebarItem;

  pathname: string;

  openGroups: OpenGroups;

  onOpenChange: (depth: number, itemKey: string, open: boolean) => void;

  depth?: number;
}

export function AdminSidebarMenuItem({
  item,
  pathname,
  openGroups,
  onOpenChange,
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

  if (!hasChildren) {
    if (!item.href) {
      return null;
    }

    if (depth === 0) {
      return (
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
            <Link href={item.href}>
              <Icon />

              <span>{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton asChild isActive={isActive}>
          <Link href={item.href}>
            <Icon />

            <span>{item.title}</span>
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

              <span>{item.title}</span>

              <ChevronRight
                className={`ml-auto transition-transform duration-200 ${chevronRotation}`}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarMenuSub>
              {children.map((child) => (
                <AdminSidebarMenuItem
                  key={getItemKey(child, depth + 1)}
                  item={child}
                  pathname={pathname}
                  openGroups={openGroups}
                  onOpenChange={onOpenChange}
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

            <span>{item.title}</span>

            <ChevronRight
              className={`ml-auto transition-transform duration-200 ${chevronRotation}`}
            />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <AdminSidebarMenuItem
                key={getItemKey(child, depth + 1)}
                item={child}
                pathname={pathname}
                openGroups={openGroups}
                onOpenChange={onOpenChange}
                depth={depth + 1}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}
