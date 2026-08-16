import { useAdminAiSettingConfigurationOptions } from "../hooks/use-admin-ai-setting-configuration-options";
import { useScrollToNewlyAddedCard } from "../hooks/use-scroll-to-newly-added-card";
import { AdminAiSettingConfigurationAddMenu } from "./AdminAiSettingConfigurationAddMenu";
import { AdminAiSettingConfigurationCard } from "./AdminAiSettingConfigurationCard";

/**
 * @description AI 설정에서 지원하는 구성 종류입니다.
 */
type AdminAiSettingConfigurationKind = "chat" | "embedding";

/**
 * @description AI 설정 폼에 추가된 구성 항목입니다.
 */
type AdminAiSettingConfigurationField = {
  /** React Hook Form의 필드 배열 항목 ID입니다. */
  fieldArrayId: string;

  /** AI 구성의 종류입니다. */
  kind: AdminAiSettingConfigurationKind;
};

/**
 * @description AI 설정 구성 관리 영역의 속성입니다.
 */
type AdminAiSettingConfigurationsSectionProps = {
  /** 현재 폼에 추가된 AI 구성 목록입니다. */
  fields: AdminAiSettingConfigurationField[];

  /** Chat 구성을 추가하는 함수입니다. */
  onAddChat: () => void;

  /** Embedding 구성을 추가하는 함수입니다. */
  onAddEmbedding: () => void;

  /** 지정한 위치의 AI 구성을 제거하는 함수입니다. */
  onRemove: (index: number) => void;
};

/**
 * @description AI 설정 폼에서 Chat 및 Embedding 구성을 추가하고 관리하는 영역입니다.
 * @param props AI 설정 구성 관리 영역의 속성입니다.
 * @returns AI 구성 추가 버튼과 현재 구성 목록을 반환합니다.
 */
export function AdminAiSettingConfigurationsSection({
  fields,
  onAddChat,
  onAddEmbedding,
  onRemove,
}: AdminAiSettingConfigurationsSectionProps) {
  const { agentOptions, chatModelOptions, embeddingModelOptions } =
    useAdminAiSettingConfigurationOptions();
  const { markPendingScroll, registerCardRef } =
    useScrollToNewlyAddedCard(fields);

  /**
   * Chat 구성 추가를 스크롤 대상으로 표시한 뒤 실제 추가 함수를 호출합니다.
   */
  function handleAddChat() {
    markPendingScroll();
    onAddChat();
  }

  /**
   * Embedding 구성 추가를 스크롤 대상으로 표시한 뒤 실제 추가 함수를 호출합니다.
   */
  function handleAddEmbedding() {
    markPendingScroll();
    onAddEmbedding();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">AI 구성</h2>
          <p className="text-muted-foreground text-sm">
            기능에서 사용할 Chat 및 Embedding 구성을 추가합니다.
          </p>
        </div>

        <AdminAiSettingConfigurationAddMenu
          onAddChat={handleAddChat}
          onAddEmbedding={handleAddEmbedding}
        />
      </div>

      {fields.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          아직 추가된 AI 구성이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <AdminAiSettingConfigurationCard
              key={field.fieldArrayId}
              ref={registerCardRef(field.fieldArrayId)}
              field={field}
              index={index}
              onRemove={onRemove}
              agentOptions={agentOptions}
              chatModelOptions={chatModelOptions}
              embeddingModelOptions={embeddingModelOptions}
            />
          ))}
        </div>
      )}
    </section>
  );
}
