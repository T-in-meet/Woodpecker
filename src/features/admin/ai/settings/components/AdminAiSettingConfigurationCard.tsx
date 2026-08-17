import { Bot, Trash2, VectorSquare } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AdminAiSettingConfigurationOption } from "../hooks/use-admin-ai-setting-configuration-options";
import { AdminAiSettingChatFields } from "./AdminAiSettingChatFields";
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
  fieldArrayId: string;

  /** AI 구성의 종류입니다. */
  kind: AdminAiSettingConfigurationKind;
};

/**
 * @description AI 구성 카드 한 장의 속성입니다.
 */
type AdminAiSettingConfigurationCardProps = {
  /** 렌더링할 구성 필드입니다. */
  field: AdminAiSettingConfigurationField;

  /** 필드 배열 내에서의 위치입니다. */
  index: number;

  /** 이 구성을 제거하는 함수입니다. */
  onRemove: (index: number) => void;

  /** Agent 선택 옵션 목록입니다. */
  agentOptions: AdminAiSettingConfigurationOption[];

  /** Chat 모델 선택 옵션 목록입니다. */
  chatModelOptions: AdminAiSettingConfigurationOption[];

  /** Embedding 모델 선택 옵션 목록입니다. */
  embeddingModelOptions: AdminAiSettingConfigurationOption[];
};

/**
 * @description Chat 또는 Embedding 구성 한 장을 렌더링하는 카드입니다.
 *
 * 새로 추가된 카드로 스크롤 이동을 지원하기 위해 바깥 `div`에 `ref`를
 * 전달받습니다.
 *
 * @param props AI 구성 카드의 속성입니다.
 * @param ref 카드 바깥 `div`에 연결할 ref입니다.
 * @returns AI 구성 카드를 반환합니다.
 */
export const AdminAiSettingConfigurationCard = forwardRef<
  HTMLDivElement,
  AdminAiSettingConfigurationCardProps
>(function AdminAiSettingConfigurationCard(
  {
    field,
    index,
    onRemove,
    agentOptions,
    chatModelOptions,
    embeddingModelOptions,
  },
  ref,
) {
  const isChat = field.kind === "chat";

  return (
    <div ref={ref}>
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
});
