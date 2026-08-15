import { AdminAiAgentDetailClient } from "@/features/admin/ai/agents/components/AdminAiAgentDetailClient";

type AdminAiAgentDetailPageProps = {
  /** 동적 route parameter입니다. */
  params: Promise<{
    agentId: string;
  }>;
};

/**
 * 관리자 AI Agent 상세 페이지를 렌더링합니다.
 *
 * @param props route props
 * @returns Agent 상세 클라이언트 컴포넌트
 */
export default async function AdminAiAgentDetailPage({
  params,
}: AdminAiAgentDetailPageProps) {
  const { agentId } = await params;

  return <AdminAiAgentDetailClient agentId={agentId} />;
}
