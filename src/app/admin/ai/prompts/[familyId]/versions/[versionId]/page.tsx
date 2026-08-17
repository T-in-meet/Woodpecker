import { AdminAiPromptVersionDetailClient } from "@/features/admin/ai/prompts/components/AdminAiPromptVersionDetailClient";

type AdminAiPromptVersionDetailPageProps = {
  /** 동적 route parameter입니다. */
  params: Promise<{
    familyId: string;
    versionId: string;
  }>;
};

/**
 * 관리자 AI Prompt Version 상세 페이지를 렌더링합니다.
 *
 * @param props route props
 * @returns Prompt Version 상세 클라이언트 컴포넌트
 */
export default async function AdminAiPromptVersionDetailPage({
  params,
}: AdminAiPromptVersionDetailPageProps) {
  const { familyId, versionId } = await params;

  return (
    <AdminAiPromptVersionDetailClient
      familyId={familyId}
      versionId={versionId}
    />
  );
}
