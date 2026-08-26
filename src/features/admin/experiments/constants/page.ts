import { ROUTES } from "@/lib/constants/routes";

export const EXPERIMENT_PAGES = [
  {
    title: "컴포넌트 플레이그라운드",
    description:
      "관리자 페이지에서 사용할 공통 컴포넌트와 목록 기능을 실험합니다.",
    href: ROUTES.ADMIN.EXPERIMENTS.COMPONENT_PLAYGROUND,
  },
] as const;
