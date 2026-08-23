import {
  AlertTriangle,
  Beaker,
  Blocks,
  Bot,
  BrainCircuit,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Settings2,
  Users,
} from "lucide-react";

import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarItem } from "../types/sidebar";

export const ADMIN_SIDEBAR_ITEMS = [
  {
    title: "관리자",
    href: ROUTES.ADMIN.DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    title: "사용자",
    href: ROUTES.ADMIN.USERS,
    icon: Users,
  },
  {
    title: "사용자 피드백",
    href: ROUTES.ADMIN.FEEDBACKS,
    icon: MessageSquareText,
  },
  {
    title: "운영 오류",
    href: ROUTES.ADMIN.OPERATIONAL_ERRORS,
    icon: AlertTriangle,
  },
  {
    title: "AI 관리",
    icon: Bot,
    breadcrumbHref: ROUTES.ADMIN.AI.DASHBOARD,
    children: [
      {
        title: "대시보드",
        href: ROUTES.ADMIN.AI.DASHBOARD,
        icon: LayoutDashboard,
        breadcrumbLabel: "AI 관리",
      },
      {
        title: "모델",
        href: ROUTES.ADMIN.AI.MODELS,
        icon: Bot,
      },
      {
        title: "에이전트",
        href: ROUTES.ADMIN.AI.AGENTS,
        icon: BrainCircuit,
      },
      {
        title: "프롬프트",
        href: ROUTES.ADMIN.AI.PROMPTS,
        icon: FileText,
      },
      {
        title: "AI 설정",
        href: ROUTES.ADMIN.AI.SETTINGS,
        icon: Settings2,
      },
    ],
  },
  {
    title: "실험 기능",
    icon: Beaker,
    breadcrumbHref: ROUTES.ADMIN.EXPERIMENTS.DASHBOARD,
    children: [
      {
        title: "대시보드",
        href: ROUTES.ADMIN.EXPERIMENTS.DASHBOARD,
        icon: LayoutDashboard,
        breadcrumbLabel: "실험 기능",
      },

      {
        title: "컴포넌트 Playground",
        href: ROUTES.ADMIN.EXPERIMENTS.COMPONENT_PLAYGROUND,
        icon: Blocks,
        breadcrumbLabel: "컴포넌트 Playground",
      },
    ],
  },
] satisfies ReadonlyArray<AdminSidebarItem>;
