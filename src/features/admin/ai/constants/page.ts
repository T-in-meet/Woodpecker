import { Bot, BrainCircuit, FileText, Settings2 } from "lucide-react";

import { ROUTES } from "@/lib/constants/routes";

/** 관리자 AI 대시보드 링크 항목입니다. */
type AdminAiPage = {
  description: string;
  href: string;
  icon: typeof Bot;
  title: string;
};

export const ADMIN_AI_PAGES: AdminAiPage[] = [
  {
    description:
      "AI 기능에서 사용할 Chat, Embedding 모델과 활성 상태를 관리합니다.",
    href: ROUTES.ADMIN.AI.MODELS,
    icon: Bot,
    title: "모델 설정",
  },
  {
    description: "AI 기능에서 사용할 에이전트와 적용할 프롬프트를 관리합니다.",
    href: ROUTES.ADMIN.AI.AGENTS,
    icon: BrainCircuit,
    title: "에이전트",
  },
  {
    description: "에이전트별 프롬프트 Family와 Version 이력을 관리합니다.",
    href: ROUTES.ADMIN.AI.PROMPTS,
    icon: FileText,
    title: "프롬프트",
  },
  {
    description: "기능별 역할에 사용할 모델과 프롬프트 구성을 관리합니다.",
    href: ROUTES.ADMIN.AI.SETTINGS,
    icon: Settings2,
    title: "AI 설정",
  },
];
