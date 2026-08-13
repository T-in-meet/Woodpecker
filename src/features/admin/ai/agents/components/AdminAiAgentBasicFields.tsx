import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

import type { AdminAiAgentDetail } from "../types";

type AdminAiAgentBasicFieldsProps = {
  /** 수정할 Agent입니다. 없으면 생성 화면의 빈 필드를 표시합니다. */
  agent?: AdminAiAgentDetail;
};

/**
 * AI Agent의 기본 정보 입력 필드를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Agent 기본 정보 필드
 */
export function AdminAiAgentBasicFields({
  agent,
}: AdminAiAgentBasicFieldsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          name="displayName"
          defaultValue={agent?.displayName ?? ""}
          placeholder="관리자 화면에 표시할 Agent 이름"
          required
        />

        <AdminTextField
          label="목적"
          name="purpose"
          defaultValue={agent?.purpose ?? ""}
          placeholder="Agent가 수행하는 역할"
          required
        />
      </div>

      <AdminTextareaField
        label="설명"
        name="description"
        defaultValue={agent?.description ?? ""}
        placeholder="Agent에 대한 상세 설명을 입력하세요."
        rows={3}
      />

      <AdminTextField
        label="Tags"
        name="tags"
        defaultValue={agent?.tags.join(", ") ?? ""}
        placeholder="쉼표로 구분하여 입력하세요."
      />
    </>
  );
}
