import { AdminAiPromptFamilyCreateClient } from "@/features/admin/ai/prompts/components/AdminAiPromptFamilyCreateClient";

type AdminAiPromptNewPageProps = {
  /** Query String Parameter입니다. */
  searchParams: Promise<{
    agentId?: string;
  }>;
};

/**
 * AI Prompt Family 생성 페이지를 렌더링합니다.
 *
 * @param props Route Props
 * @returns Prompt Family 생성 클라이언트 컴포넌트
 */
export default async function AdminAiPromptNewPage({
  searchParams,
}: AdminAiPromptNewPageProps) {
  const { agentId } = await searchParams;

  return agentId ? (
    <AdminAiPromptFamilyCreateClient initialAgentId={agentId} />
  ) : (
    <AdminAiPromptFamilyCreateClient />
  );
}
