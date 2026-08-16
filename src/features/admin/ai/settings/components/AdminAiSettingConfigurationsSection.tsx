import { Bot, Trash2, VectorSquare } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useAdminAiAgentOptions } from "../../agents/hooks/use-admin-ai-agent-queries";
import { useAdminAiModelOptions } from "../../models/hooks/use-admin-ai-model-queries";
import { AdminAiSettingChatFields } from "./AdminAiSettingChatFields";
import { AdminAiSettingConfigurationAddMenu } from "./AdminAiSettingConfigurationAddMenu";
import { AdminAiSettingEmbeddingFields } from "./AdminAiSettingEmbeddingFields";

/**
 * @description AI 설정에서 지원하는 구성 종류입니다.
 */
type AdminAiSettingConfigurationKind = "chat" | "embedding";

/**
 * @description AI 설정 폼에 추가된 구성 항목입니다.
 */
type AdminAiSettingConfigurationField = {
  /** React Hook Form의 필드 배열 항목 ID입니다. */
  id: string;

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
 * 요소를 기준으로 위로 순회하며 실제로 스크롤 가능한 조상 요소를 찾습니다.
 *
 * `overflow-y`가 auto/scroll이면서 콘텐츠가 실제로 넘치는 요소를 우선하고,
 * 찾지 못하면 document의 스크롤 요소를 최종 폴백으로 사용합니다.
 *
 * @param node 탐색을 시작할 DOM 노드
 * @returns 스크롤 가능한 요소
 */
function findScrollableAncestor(node: HTMLElement): HTMLElement {
  let current: HTMLElement | null = node.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const canScrollY =
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight;

    if (canScrollY) {
      return current;
    }

    current = current.parentElement;
  }

  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

/**
 * 지정한 노드가 화면에 보이도록 스크롤 가능한 조상 요소를 클램프된 좌표로 스크롤합니다.
 *
 * @param node 스크롤 대상이 되는 카드의 DOM 노드
 */
function scrollCardIntoView(node: HTMLElement) {
  const scroller = findScrollableAncestor(node);
  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;

  const isDocumentScroller =
    scroller === document.scrollingElement ||
    scroller === document.documentElement;

  const targetTop = isDocumentScroller
    ? node.getBoundingClientRect().top + window.scrollY - 24
    : node.offsetTop - scroller.offsetTop - 24;

  scroller.scrollTo({
    top: Math.min(Math.max(targetTop, 0), maxScrollTop),
    behavior: "smooth",
  });
}

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
  const { data: agents = [] } = useAdminAiAgentOptions();
  const { data: chatModels = [] } = useAdminAiModelOptions("chat");
  const { data: embeddingModels = [] } = useAdminAiModelOptions("embedding");

  const agentOptions = agents.map((agent) => ({
    label: agent.displayName,
    value: agent.id,
  }));

  const chatModelOptions = chatModels.map((model) => ({
    label: `${model.displayName} · ${model.provider}/${model.model}`,
    value: model.id,
  }));

  const embeddingModelOptions = embeddingModels.map((model) => ({
    label: `${model.displayName} · ${model.provider}/${model.model}`,
    value: model.id,
  }));

  /** 각 구성 카드의 DOM 노드를 field.id 기준으로 보관하는 맵입니다. */
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /**
   * 사용자가 방금 "구성 추가" 버튼을 눌렀는지 여부입니다.
   *
   * fields.length 변화만으로는 초기 데이터 로딩(form.reset)과
   * 실제 사용자의 추가 동작을 구분할 수 없기 때문에,
   * 버튼 클릭 시점에만 명시적으로 true로 세팅합니다.
   */
  const pendingScrollRef = useRef(false);

  useEffect(() => {
    if (!pendingScrollRef.current || fields.length === 0) {
      return;
    }

    pendingScrollRef.current = false;

    const lastField = fields[fields.length - 1];

    if (!lastField) {
      return;
    }

    const node = cardRefs.current.get(lastField.id);

    if (!node) {
      return;
    }

    /*
     * 레이아웃과 페인트가 완전히 끝난 뒤에 위치를 측정하기 위해
     * requestAnimationFrame을 두 번 중첩합니다.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollCardIntoView(node);
      });
    });
  }, [fields]);

  /**
   * Chat 구성 추가를 스크롤 대상으로 표시한 뒤 실제 추가 함수를 호출합니다.
   */
  function handleAddChat() {
    pendingScrollRef.current = true;
    onAddChat();
  }

  /**
   * Embedding 구성 추가를 스크롤 대상으로 표시한 뒤 실제 추가 함수를 호출합니다.
   */
  function handleAddEmbedding() {
    pendingScrollRef.current = true;
    onAddEmbedding();
  }

  /**
   * 구성 카드의 DOM 노드를 ref 맵에 등록하거나 제거합니다.
   *
   * @param fieldId 등록할 구성 필드의 ID
   * @returns ref 콜백 함수
   */
  function registerCardRef(fieldId: string) {
    return (node: HTMLDivElement | null) => {
      if (node) {
        cardRefs.current.set(fieldId, node);
      } else {
        cardRefs.current.delete(fieldId);
      }
    };
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
          {fields.map((field, index) => {
            const isChat = field.kind === "chat";

            return (
              <div key={field.id} ref={registerCardRef(field.id)}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {isChat ? (
                        <Bot aria-hidden="true" className="size-4" />
                      ) : (
                        <VectorSquare aria-hidden="true" className="size-4" />
                      )}

                      {isChat ? "Chat 구성" : "Embedding 구성"}
                    </CardTitle>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${isChat ? "Chat" : "Embedding"} 구성 삭제`}
                      onClick={() => onRemove(index)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </CardHeader>

                  <CardContent>
                    {isChat ? (
                      <AdminAiSettingChatFields
                        index={index}
                        agentOptions={agentOptions}
                        chatModelOptions={chatModelOptions}
                      />
                    ) : (
                      <AdminAiSettingEmbeddingFields
                        index={index}
                        embeddingModelOptions={embeddingModelOptions}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
