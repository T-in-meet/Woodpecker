import { Beaker, FileText, LayoutDashboard, Link2, Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarItem } from "../types/sidebar";
import { getAdminBreadcrumbItems } from "./admin-breadcrumb";

const PROMPTS_PATH = "/admin/experiments/note-relations/prompts";

const DASHBOARD_ITEM: AdminSidebarItem = {
  title: "대시보드",
  href: ROUTES.ADMIN.DASHBOARD,
  icon: LayoutDashboard,
};

const USERS_ITEM: AdminSidebarItem = {
  title: "사용자",
  href: ROUTES.ADMIN.USERS,
  icon: Users,
};

const EXPERIMENTS_ITEM: AdminSidebarItem = {
  title: "실험 기능",
  icon: Beaker,
  children: [
    {
      title: "노트 연결",
      icon: Link2,
      children: [
        {
          title: "대시보드",
          href: "/admin/experiments/note-relations",
          icon: LayoutDashboard,
        },
        {
          title: "프롬프트",
          href: PROMPTS_PATH,
          icon: FileText,
        },
      ],
    },
  ],
};

const SIDEBAR_ITEMS: readonly AdminSidebarItem[] = [
  DASHBOARD_ITEM,
  USERS_ITEM,
  EXPERIMENTS_ITEM,
];

describe("getAdminBreadcrumbItems", () => {
  it("대시보드 경로에서는 대시보드 breadcrumb만 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, ROUTES.ADMIN.DASHBOARD),
    ).toEqual([
      {
        label: "대시보드",
        href: ROUTES.ADMIN.DASHBOARD,
      },
    ]);
  });

  it("대시보드는 다른 관리자 하위 경로에서 일치하지 않는다", () => {
    expect(
      getAdminBreadcrumbItems([DASHBOARD_ITEM], ROUTES.ADMIN.USERS),
    ).toEqual([]);
  });

  it("일반 최상위 페이지의 breadcrumb를 반환한다", () => {
    expect(getAdminBreadcrumbItems(SIDEBAR_ITEMS, ROUTES.ADMIN.USERS)).toEqual([
      {
        label: "사용자",
        href: ROUTES.ADMIN.USERS,
      },
    ]);
  });

  it("중첩된 메뉴의 부모 항목을 순서대로 포함한다", () => {
    expect(getAdminBreadcrumbItems(SIDEBAR_ITEMS, PROMPTS_PATH)).toEqual([
      {
        label: "실험 기능",
      },
      {
        label: "노트 연결",
      },
      {
        label: "프롬프트",
        href: PROMPTS_PATH,
      },
    ]);
  });

  it("상세 경로에서도 목록 메뉴를 기준으로 breadcrumb를 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, `${PROMPTS_PATH}/123`),
    ).toEqual([
      {
        label: "실험 기능",
      },
      {
        label: "노트 연결",
      },
      {
        label: "프롬프트",
        href: PROMPTS_PATH,
      },
    ]);
  });

  it("더 깊은 상세 경로에서도 동일한 breadcrumb를 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, `${PROMPTS_PATH}/123/version/1`),
    ).toEqual([
      {
        label: "실험 기능",
      },
      {
        label: "노트 연결",
      },
      {
        label: "프롬프트",
        href: PROMPTS_PATH,
      },
    ]);
  });

  it("문자열 접두사만 같은 경로는 일치하지 않는다", () => {
    const items: readonly AdminSidebarItem[] = [
      {
        title: "프롬프트",
        href: PROMPTS_PATH,
        icon: FileText,
      },
    ];

    expect(getAdminBreadcrumbItems(items, `${PROMPTS_PATH}-archived`)).toEqual(
      [],
    );
  });

  it("href가 없는 그룹에는 href를 포함하지 않는다", () => {
    const result = getAdminBreadcrumbItems(SIDEBAR_ITEMS, PROMPTS_PATH);

    expect(result[0]).toEqual({
      label: "실험 기능",
    });

    expect(result[1]).toEqual({
      label: "노트 연결",
    });
  });

  it("일치하는 경로가 없으면 빈 배열을 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, "/admin/not-existing-page"),
    ).toEqual([]);
  });
});
