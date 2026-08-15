import { AdminAiModelDetailClient } from "@/features/admin/ai/models/components/AdminAiModelDetailClient";

type AdminAiModelDetailPageProps = {
  /** 동적 route parameter입니다. */
  params: Promise<{
    modelConfigId: string;
  }>;
};

/**
 * AI 모델 상세 페이지를 렌더링합니다.
 *
 * @param props route props
 * @returns 모델 상세 폼
 */
export default async function AdminAiModelDetailPage({
  params,
}: AdminAiModelDetailPageProps) {
  const { modelConfigId } = await params;

  return <AdminAiModelDetailClient modelConfigId={modelConfigId} />;
}
