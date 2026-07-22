import {
  Beaker,
  FileSearch,
  FileText,
  LayoutDashboard,
  Link2,
  Network,
  Users,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarItem } from "../types/sidebar";
import { getAdminBreadcrumbItems } from "./admin-breadcrumb";

const EXPERIMENTS_PATH = ROUTES.ADMIN.EXPERIMENTS.DASHBOARD;

const NOTE_RELATIONS_PATH = ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.DASHBOARD;

const PROMPTS_PATH = ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.PROMPTS;

const KNOWLEDGE_EXTRACTIONS_PATH =
  ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.KNOWLEDGE_EXTRACTIONS;

const DASHBOARD_ITEM: AdminSidebarItem = {
  title: "관리자",
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
  breadcrumbHref: EXPERIMENTS_PATH,
  children: [
    {
      title: "대시보드",
      href: EXPERIMENTS_PATH,
      icon: LayoutDashboard,
      breadcrumbLabel: "실험 기능",
    },
    {
      title: "노트 연결",
      icon: Link2,
      breadcrumbHref: NOTE_RELATIONS_PATH,
      children: [
        {
          title: "대시보드",
          href: NOTE_RELATIONS_PATH,
          icon: LayoutDashboard,
          breadcrumbLabel: "노트 연결",
        },
        {
          title: "프롬프트",
          href: PROMPTS_PATH,
          icon: FileText,
        },
        {
          title: "지식 객체 생성",
          icon: Network,
          children: [
            {
              title: "지식 추출",
              href: KNOWLEDGE_EXTRACTIONS_PATH,
              icon: FileSearch,
            },
          ],
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
  it("관리자 대시보드 경로에서는 관리자 breadcrumb만 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, ROUTES.ADMIN.DASHBOARD),
    ).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
    ]);
  });

  it("관리자 대시보드는 다른 관리자 하위 경로와 일치하지 않는다", () => {
    expect(
      getAdminBreadcrumbItems([DASHBOARD_ITEM], ROUTES.ADMIN.USERS),
    ).toEqual([]);
  });

  it("일반 최상위 관리자 페이지에는 관리자 breadcrumb를 먼저 포함한다", () => {
    expect(getAdminBreadcrumbItems(SIDEBAR_ITEMS, ROUTES.ADMIN.USERS)).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "사용자",
        href: ROUTES.ADMIN.USERS,
      },
    ]);
  });

  it("breadcrumbHref가 있는 그룹을 breadcrumb에 포함한다", () => {
    expect(getAdminBreadcrumbItems(SIDEBAR_ITEMS, PROMPTS_PATH)).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "실험 기능",
        href: EXPERIMENTS_PATH,
      },
      {
        label: "노트 연결",
        href: NOTE_RELATIONS_PATH,
      },
      {
        label: "프롬프트",
        href: PROMPTS_PATH,
      },
    ]);
  });

  it("href와 breadcrumbHref가 모두 없는 중간 그룹은 breadcrumb에서 제외한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, KNOWLEDGE_EXTRACTIONS_PATH),
    ).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "실험 기능",
        href: EXPERIMENTS_PATH,
      },
      {
        label: "노트 연결",
        href: NOTE_RELATIONS_PATH,
      },
      {
        label: "지식 추출",
        href: KNOWLEDGE_EXTRACTIONS_PATH,
      },
    ]);
  });

  it("실험 기능 대시보드에서는 동일한 breadcrumb를 중복하지 않는다", () => {
    expect(getAdminBreadcrumbItems(SIDEBAR_ITEMS, EXPERIMENTS_PATH)).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "실험 기능",
        href: EXPERIMENTS_PATH,
      },
    ]);
  });

  it("노트 연결 대시보드에서는 동일한 breadcrumb를 중복하지 않는다", () => {
    expect(getAdminBreadcrumbItems(SIDEBAR_ITEMS, NOTE_RELATIONS_PATH)).toEqual(
      [
        {
          label: "관리자",
          href: ROUTES.ADMIN.DASHBOARD,
        },
        {
          label: "실험 기능",
          href: EXPERIMENTS_PATH,
        },
        {
          label: "노트 연결",
          href: NOTE_RELATIONS_PATH,
        },
      ],
    );
  });

  it("상세 경로에서도 목록 메뉴를 기준으로 breadcrumb를 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, `${PROMPTS_PATH}/123`),
    ).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "실험 기능",
        href: EXPERIMENTS_PATH,
      },
      {
        label: "노트 연결",
        href: NOTE_RELATIONS_PATH,
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
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "실험 기능",
        href: EXPERIMENTS_PATH,
      },
      {
        label: "노트 연결",
        href: NOTE_RELATIONS_PATH,
      },
      {
        label: "프롬프트",
        href: PROMPTS_PATH,
      },
    ]);
  });

  it("breadcrumbLabel이 있으면 title 대신 해당 label을 사용한다", () => {
    const items: readonly AdminSidebarItem[] = [
      DASHBOARD_ITEM,
      {
        title: "대시보드",
        href: EXPERIMENTS_PATH,
        icon: LayoutDashboard,
        breadcrumbLabel: "실험 기능",
      },
    ];

    expect(getAdminBreadcrumbItems(items, EXPERIMENTS_PATH)).toEqual([
      {
        label: "관리자",
        href: ROUTES.ADMIN.DASHBOARD,
      },
      {
        label: "실험 기능",
        href: EXPERIMENTS_PATH,
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

  it("breadcrumbHref만 있는 그룹 자체는 경로 일치 대상으로 사용하지 않는다", () => {
    const items: readonly AdminSidebarItem[] = [
      DASHBOARD_ITEM,
      {
        title: "실험 기능",
        icon: Beaker,
        breadcrumbHref: EXPERIMENTS_PATH,
      },
    ];

    expect(getAdminBreadcrumbItems(items, EXPERIMENTS_PATH)).toEqual([]);
  });

  it("일치하는 경로가 없으면 빈 배열을 반환한다", () => {
    expect(
      getAdminBreadcrumbItems(SIDEBAR_ITEMS, "/admin/not-existing-page"),
    ).toEqual([]);
  });
});
