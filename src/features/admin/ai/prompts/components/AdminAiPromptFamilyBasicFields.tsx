import { AdminSelectField } from "@/features/admin/components/common/AdminSelectField";
import { AdminTextareaField } from "@/features/admin/components/common/AdminTextareaField";
import { AdminTextField } from "@/features/admin/components/common/AdminTextField";

type AdminAiPromptAgentOption = {
  /** Agent 표시 이름 */
  displayName: string;

  /** Agent ID */
  id: string;
};

type AdminAiPromptFamilyBasicFieldsProps = {
  /** 생성 모드 여부 */
  createMode: boolean;

  /** Agent 선택 목록 */
  agentOptions: AdminAiPromptAgentOption[];

  /** Agent 선택 목록 조회 진행 여부 */
  isAgentOptionsPending: boolean;

  /** 생성 화면에서 선택할 Agent ID */
  selectedAgentId: string;

  /** Family 표시 이름 */
  displayName: string;

  /** Family 설명 */
  description: string;

  /** 쉼표로 구분한 Family Tag */
  tags: string;

  /** Agent 선택 변경 이벤트 */
  onAgentIdChange: (value: string) => void;

  /** 표시 이름 변경 이벤트 */
  onDisplayNameChange: (value: string) => void;
};

/**
 * AI Prompt Family의 Agent와 기본 정보 입력 필드를 렌더링합니다.
 *
 * 생성 화면에서는 Family에 연결할 Agent를 선택합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Family 기본 정보 필드
 */
export function AdminAiPromptFamilyBasicFields({
  createMode,
  agentOptions,
  isAgentOptionsPending,
  selectedAgentId,
  displayName,
  description,
  tags,
  onAgentIdChange,
  onDisplayNameChange,
}: AdminAiPromptFamilyBasicFieldsProps) {
  return (
    <>
      {createMode ? (
        <AdminSelectField
          label="Agent"
          name="agentId"
          value={selectedAgentId}
          placeholder={
            isAgentOptionsPending
              ? "Agent 목록을 불러오는 중입니다."
              : "Agent를 선택하세요."
          }
          disabled={isAgentOptionsPending}
          onValueChange={onAgentIdChange}
          options={agentOptions.map((agent) => ({
            label: `${agent.displayName}`,
            value: agent.id,
          }))}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Agent</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <AdminTextField
          label="이름"
          name="displayName"
          value={displayName}
          placeholder="관리자 화면에 표시할 Prompt Family 이름"
          onChange={(event) => onDisplayNameChange(event.target.value)}
          required
        />
      </div>

      <AdminTextareaField
        label="설명"
        name="description"
        defaultValue={description}
        placeholder="Prompt Family의 목적과 사용 방식을 입력하세요."
        rows={3}
      />

      <AdminTextField
        label="Tags"
        name="tags"
        defaultValue={tags}
        placeholder="쉼표로 구분하여 입력하세요."
      />
    </>
  );
}
