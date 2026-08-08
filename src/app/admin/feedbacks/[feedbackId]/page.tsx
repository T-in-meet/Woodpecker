import { AdminFeedbackDetailClient } from "@/features/admin/feedbacks/components/AdminFeedbackDetailClient";

/**
 * 관리자 피드백 상세 route입니다.
 *
 * 실제 데이터 조회와 답변 작성 상태는 클라이언트 컨테이너에서
 * TanStack Query와 Server Action으로 처리합니다.
 */
export default function AdminFeedbackDetailPage() {
  return <AdminFeedbackDetailClient />;
}
