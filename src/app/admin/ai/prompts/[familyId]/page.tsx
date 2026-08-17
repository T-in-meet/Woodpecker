import { AdminAiPromptFamilyDetailClient } from "@/features/admin/ai/prompts/components/AdminAiPromptFamilyDetailClient";

type AdminAiPromptFamilyDetailPageProps = {
  /** 동적 route parameter입니다. */
  params: Promise<{
    familyId: string;
  }>;
};

/**
 * 관리자 AI Prompt Family 상세 페이지를 렌더링합니다.
 *
 * @param props route props
 * @returns Prompt Family 상세 클라이언트 컴포넌트
 */
export default async function AdminAiPromptFamilyDetailPage({
  params,
}: AdminAiPromptFamilyDetailPageProps) {
  const { familyId } = await params;

  return <AdminAiPromptFamilyDetailClient familyId={familyId} />;
}
