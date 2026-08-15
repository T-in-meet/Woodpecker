import type { AdminAiAgentDetail } from "../types";

type AdminAiAgentPromptFamiliesTableProps = {
  /** Agent에 연결된 Prompt Family 목록입니다. */
  families: AdminAiAgentDetail["families"];
};

/**
 * AI Agent에 연결된 Prompt Family 목록을 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 연결된 Prompt Family 테이블 또는 null
 */
export function AdminAiAgentPromptFamiliesTable({
  families,
}: AdminAiAgentPromptFamiliesTableProps) {
  if (families.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">연결된 프롬프트</h2>

      <div className="overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">프롬프트</th>
                <th className="px-4 py-3 text-left font-medium">버전 현황</th>
              </tr>
            </thead>

            <tbody>
              {families.map((family) => (
                <tr key={family.id} className="border-b last:border-b-0">
                  <td className="max-w-72 px-4 py-3 align-top">
                    <span
                      className="block truncate font-mono text-xs"
                      title={family.displayName}
                    >
                      {family.displayName}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    draft {family.draftVersionCount} / published{" "}
                    {family.publishedVersionCount} / archived{" "}
                    {family.archivedVersionCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
