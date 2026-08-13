import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

/**
 * AI Prompt Family 생성 시 함께 등록할 초기 Version 필드를 렌더링합니다.
 *
 * @returns 초기 Prompt Version 입력 필드
 */
export function AdminAiPromptInitialVersionFields() {
  return (
    <section className="grid content-start gap-5 border-t pt-5 xl:border-t-0 xl:pt-0">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">초기 Draft Version</h2>
        <p className="text-sm text-muted-foreground">
          Prompt Family 생성과 함께 사용할 첫 Draft Version을 등록합니다.
        </p>
      </div>

      <AdminTextField
        label="초기 Version 이름"
        name="versionDisplayName"
        defaultValue="v1 draft"
        placeholder="초기 Prompt Version 이름"
        required
      />

      <AdminTextField
        label="변경 요약"
        name="changeSummary"
        placeholder="초기 Version의 변경 내용을 입력하세요."
      />

      <AdminTextareaField
        label="System Template"
        name="systemTemplate"
        placeholder="System Prompt Template을 입력하세요."
        rows={8}
        required
      />

      <AdminTextareaField
        label="User Template"
        name="userTemplate"
        placeholder="User Prompt Template을 입력하세요."
        rows={8}
        required
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextareaField
          label="Variables JSON"
          name="variables"
          placeholder="Prompt 변수 정의를 JSON 배열로 입력하세요."
          rows={6}
        />

        <AdminTextareaField
          label="Response Schema JSON"
          name="responseSchema"
          placeholder="응답 Schema를 JSON 객체로 입력하세요."
          rows={6}
        />
      </div>
    </section>
  );
}
