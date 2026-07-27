import { Beaker, FileText, LayoutDashboard, Link2, Users } from "lucide-react";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarItem } from "../types/sidebar";
import {
  getActiveGroups,
  getItemKey,
  hasActiveItem,
  isPathActive,
} from "./admin-sidebar";

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
          title: "프롬프트",
          href: "/admin/experiments/note-relations/prompts",
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

describe("isPathActive", () => {
  it("href가 없으면 false를 반환한다", () => {
    expect(isPathActive(ROUTES.ADMIN.DASHBOARD)).toBe(false);
  });

  it("대시보드 경로가 정확히 일치하면 true를 반환한다", () => {
    expect(isPathActive(ROUTES.ADMIN.DASHBOARD, ROUTES.ADMIN.DASHBOARD)).toBe(
      true,
    );
  });

  it("대시보드는 하위 관리자 경로에서 활성화되지 않는다", () => {
    expect(isPathActive(ROUTES.ADMIN.USERS, ROUTES.ADMIN.DASHBOARD)).toBe(
      false,
    );
  });

  it("일반 메뉴 경로가 정확히 일치하면 true를 반환한다", () => {
    expect(isPathActive(ROUTES.ADMIN.USERS, ROUTES.ADMIN.USERS)).toBe(true);
  });

  it("일반 메뉴의 상세 하위 경로에서도 true를 반환한다", () => {
    expect(isPathActive(`${ROUTES.ADMIN.USERS}/123`, ROUTES.ADMIN.USERS)).toBe(
      true,
    );
  });

  it("문자열 접두사만 같은 경로는 활성화하지 않는다", () => {
    expect(
      isPathActive(`${ROUTES.ADMIN.USERS}-archived`, ROUTES.ADMIN.USERS),
    ).toBe(false);
  });
});

describe("hasActiveItem", () => {
  it("항목 자신의 href가 활성 경로이면 true를 반환한다", () => {
    expect(hasActiveItem(ROUTES.ADMIN.USERS, USERS_ITEM)).toBe(true);
  });

  it("직계 자식이 활성 경로이면 true를 반환한다", () => {
    const item: AdminSidebarItem = {
      title: "사용자 관리",
      icon: Users,
      children: [USERS_ITEM],
    };

    expect(hasActiveItem(ROUTES.ADMIN.USERS, item)).toBe(true);
  });

  it("깊은 하위 자식이 활성 경로이면 true를 반환한다", () => {
    expect(
      hasActiveItem(
        "/admin/experiments/note-relations/prompts/123",
        EXPERIMENTS_ITEM,
      ),
    ).toBe(true);
  });

  it("자신과 모든 하위 항목이 활성 경로가 아니면 false를 반환한다", () => {
    expect(hasActiveItem(ROUTES.ADMIN.USERS, EXPERIMENTS_ITEM)).toBe(false);
  });
});

describe("getItemKey", () => {
  it("depth, title, href를 조합해 키를 생성한다", () => {
    expect(getItemKey(USERS_ITEM, 0)).toBe(`0-사용자-${ROUTES.ADMIN.USERS}`);
  });

  it("href가 없는 그룹에는 group을 사용한다", () => {
    expect(getItemKey(EXPERIMENTS_ITEM, 0)).toBe("0-실험 기능-group");
  });
});

describe("getActiveGroups", () => {
  it("일치하는 그룹이 없으면 빈 객체를 반환한다", () => {
    expect(getActiveGroups(SIDEBAR_ITEMS, ROUTES.ADMIN.USERS)).toEqual({});
  });

  it("깊은 하위 메뉴가 활성화되면 모든 부모 그룹을 반환한다", () => {
    expect(
      getActiveGroups(
        SIDEBAR_ITEMS,
        "/admin/experiments/note-relations/prompts",
      ),
    ).toEqual({
      0: "0-실험 기능-group",
      1: "1-노트 연결-group",
    });
  });

  it("상세 하위 경로에서도 부모 그룹을 반환한다", () => {
    expect(
      getActiveGroups(
        SIDEBAR_ITEMS,
        "/admin/experiments/note-relations/prompts/123/version/1",
      ),
    ).toEqual({
      0: "0-실험 기능-group",
      1: "1-노트 연결-group",
    });
  });

  it("활성 항목과 관계없는 형제 그룹은 포함하지 않는다", () => {
    const items: readonly AdminSidebarItem[] = [
      ...SIDEBAR_ITEMS,
      {
        title: "다른 실험",
        icon: Beaker,
        children: [
          {
            title: "다른 페이지",
            href: "/admin/experiments/other",
            icon: FileText,
          },
        ],
      },
    ];

    expect(
      getActiveGroups(items, "/admin/experiments/note-relations/prompts"),
    ).toEqual({
      0: "0-실험 기능-group",
      1: "1-노트 연결-group",
    });
  });
});
