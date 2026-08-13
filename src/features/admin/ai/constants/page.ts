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
      "기능에서 명시적으로 참조할 모델 key와 capability를 확인합니다.",
    href: ROUTES.ADMIN.AI.MODELS,
    icon: Bot,
    title: "모델 설정",
  },
  {
    description:
      "기능 코드가 참조하는 agent key와 active prompt 슬롯을 관리합니다.",
    href: ROUTES.ADMIN.AI.AGENTS,
    icon: BrainCircuit,
    title: "에이전트",
  },
  {
    description: "Agent에 적용할 prompt family와 version 이력을 관리합니다.",
    href: ROUTES.ADMIN.AI.PROMPTS,
    icon: FileText,
    title: "프롬프트",
  },
  {
    description:
      "기능별로 사용할 Chat, Embedding 모델과 Prompt 구성을 관리합니다.",
    href: ROUTES.ADMIN.AI.SETTINGS,
    icon: Settings2,
    title: "AI 설정",
  },
];
