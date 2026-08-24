import { AdminCollapsibleSection } from "@/features/admin/components/common/AdminCollapsibleSection";

type AdminOperationalErrorContextCardProps = {
  /** 오류 발생 시 함께 저장된 진단 정보 */
  context: unknown;
};

/**
 * 운영 오류 발생 시 수집된 진단 정보를 JSON 형태로 표시합니다.
 */
export function AdminOperationalErrorContextCard({
  context,
}: AdminOperationalErrorContextCardProps) {
  return (
    <AdminCollapsibleSection title="진단 정보" defaultOpen={false}>
      <pre className="max-h-128 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-muted p-4 text-xs">
        {JSON.stringify(context, null, 2)}
      </pre>
    </AdminCollapsibleSection>
  );
}
