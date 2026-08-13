import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";

/**
 * AI 관리자 화면 경로들을 재검증합니다.
 */
export function revalidateAdminAiPaths() {
  revalidatePath(ROUTES.ADMIN.AI.DASHBOARD);
  revalidatePath(ROUTES.ADMIN.AI.MODELS);
  revalidatePath(ROUTES.ADMIN.AI.AGENTS);
  revalidatePath(ROUTES.ADMIN.AI.PROMPTS);
}
