import { notFound } from "next/navigation";

import { AdminAiPromptVersionForm } from "@/features/admin/ai/prompts/components/AdminAiPromptVersionForm";
import { getAdminAiPromptFamilyDetail } from "@/features/admin/ai/prompts/queries";

type AdminAiPromptVersionNewPageProps = {
  /** 동적 route parameter입니다. */
  params: Promise<{
    familyId: string;
  }>;
};

/**
 * AI prompt version 생성 페이지를 렌더링합니다.
 *
 * @param props route props
 * @returns prompt version 생성 폼
 */
export default async function AdminAiPromptVersionNewPage({
  params,
}: AdminAiPromptVersionNewPageProps) {
  const { familyId } = await params;
  const family = await getAdminAiPromptFamilyDetail(familyId);

  if (!family) {
    notFound();
  }

  return <AdminAiPromptVersionForm family={family} />;
}
