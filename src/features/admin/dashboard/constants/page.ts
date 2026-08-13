import {
  AlertTriangle,
  Beaker,
  Bot,
  MessageSquareText,
  Users,
} from "lucide-react";

import { ROUTES } from "@/lib/constants/routes";

/** 관리자 대시보드에서 제공하는 주요 관리 화면 링크입니다. */
type AdminPage = {
  description: string;
  href: string;
  icon: typeof Users;
  title: string;
};

/**
 * 관리자 대시보드에서 바로 이동할 수 있는 대표 관리 화면입니다.
 *
 * Sidebar의 전체 계층 구조를 그대로 노출하지 않고,
 * 각 관리 영역의 대표 진입점만 제공합니다.
 */
export const ADMIN_PAGES: AdminPage[] = [
  {
    description: "사용자 계정과 관리자 권한을 관리합니다.",
    href: ROUTES.ADMIN.USERS,
    icon: Users,
    title: "사용자",
  },
  {
    description: "사용자가 전달한 피드백을 확인하고 관리합니다.",
    href: ROUTES.ADMIN.FEEDBACKS,
    icon: MessageSquareText,
    title: "사용자 피드백",
  },
  {
    description: "서비스에서 발생한 운영 오류를 확인하고 관리합니다.",
    href: ROUTES.ADMIN.OPERATIONAL_ERRORS,
    icon: AlertTriangle,
    title: "운영 오류",
  },
  {
    description: "AI 모델, Agent, Prompt 및 기능별 설정을 관리합니다.",
    href: ROUTES.ADMIN.AI.DASHBOARD,
    icon: Bot,
    title: "AI 관리",
  },
  {
    description: "개발 및 검증 중인 관리자 실험 기능을 확인합니다.",
    href: ROUTES.ADMIN.EXPERIMENTS.DASHBOARD,
    icon: Beaker,
    title: "실험 기능",
  },
];
