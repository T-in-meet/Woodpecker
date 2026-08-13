import { AdminAiSettingsDetailClient } from "@/features/admin/ai/settings/components/AdminAiSettingsDetailClient";

/**
 * @description 관리자 AI 설정 상세 페이지의 속성입니다.
 */
type AdminAiSettingsDetailPageProps = {
  /** 조회할 AI 설정 ID를 포함한 동적 route parameter입니다. */
  params: Promise<{
    settingId: string;
  }>;
};

/**
 * @description 관리자 AI 설정 상세 페이지입니다.
 * @param props 관리자 AI 설정 상세 페이지의 속성입니다.
 * @returns 지정한 AI 설정의 상세 화면을 반환합니다.
 */
export default async function AdminAiSettingsDetailPage({
  params,
}: AdminAiSettingsDetailPageProps) {
  const { settingId } = await params;

  return <AdminAiSettingsDetailClient settingId={settingId} />;
}
