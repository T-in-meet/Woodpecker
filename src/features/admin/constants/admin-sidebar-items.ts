import {
  Beaker,
  Boxes,
  FileSearch,
  FileText,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  Network,
  Users,
} from "lucide-react";

import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarItem } from "../types/sidebar";

export const ADMIN_SIDEBAR_ITEMS = [
  {
    title: "대시보드",
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
    href: ROUTES.ADMIN.FEEDBACK,
    icon: MessageSquareText,
  },
  {
    title: "기능 운영",
    href: ROUTES.ADMIN.FEATURES,
    icon: FlaskConical,
  },
  {
    title: "실험 기능",
    icon: Beaker,
    children: [
      {
        title: "노트 연결",
        icon: Link2,
        href: "",
        children: [
          {
            title: "대시보드",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.DASHBOARD,
            icon: LayoutDashboard,
          },
          {
            title: "노트 관계",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.NOTE_RELATIONS,
            icon: GitBranch,
          },
          {
            title: "프롬프트",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.PROMPTS,
            icon: FileText,
          },
          {
            title: "지식 추출",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.KNOWLEDGE_EXTRACTIONS,
            icon: FileSearch,
          },
          {
            title: "지식 객체",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS.KNOWLEDGE_OBJECTS,
            icon: Boxes,
          },
          {
            title: "지식 객체 생성",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS
              .KNOWLEDGE_OBJECT_GENERATIONS,
            icon: Network,
          },
          {
            title: "지식 객체 관계",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS
              .KNOWLEDGE_OBJECT_RELATIONS,
            icon: GitBranch,
          },
          {
            title: "관계 생성 기록",
            href: ROUTES.ADMIN.EXPERIMENTS.NOTE_RELATIONS
              .KNOWLEDGE_OBJECT_RELATION_GENERATIONS,
            icon: Network,
          },
        ],
      },
    ],
  },
] satisfies ReadonlyArray<AdminSidebarItem>;
