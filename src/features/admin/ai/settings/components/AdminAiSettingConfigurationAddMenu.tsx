import { Bot, Database, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * @description AI 구성 추가 메뉴의 속성입니다.
 */
type AdminAiSettingConfigurationAddMenuProps = {
  /** Chat 구성을 추가하는 함수입니다. */
  onAddChat: () => void;

  /** Embedding 구성을 추가하는 함수입니다. */
  onAddEmbedding: () => void;
};

/**
 * @description Chat 또는 Embedding 구성을 추가하는 드롭다운 메뉴입니다.
 * @param props AI 구성 추가 메뉴의 속성입니다.
 * @returns AI 구성 추가 드롭다운 메뉴를 반환합니다.
 */
export function AdminAiSettingConfigurationAddMenu({
  onAddChat,
  onAddEmbedding,
}: AdminAiSettingConfigurationAddMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="shrink-0">
          <Plus aria-hidden="true" />
          구성 추가
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-max min-w-max"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DropdownMenuItem onSelect={onAddChat}>
          <Bot aria-hidden="true" />
          Chat 구성 추가
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={onAddEmbedding}>
          <Database aria-hidden="true" />
          Embedding 구성 추가
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
