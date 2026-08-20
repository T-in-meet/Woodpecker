import { Info } from "lucide-react";

/**
 * Related Notes의 Note 검색에서 사용하는 Embedding 설정 안내를 표시합니다.
 *
 * Related Notes는 별도의 Note retrieval embedding 설정을 사용하지 않고,
 * 공통 Note retrieval runtime인 Note Chat의 note-retrieval 설정을 공유합니다.
 */
export function AdminAiSettingRelatedNotesNotice() {
  return (
    <div className="flex gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-destructive" />

      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">
          Related Notes Embedding 설정
        </p>

        <p className="text-sm leading-6 text-foreground">
          Related Notes의 Note 검색은 공통 Note Retrieval 설정을 사용합니다.
          Embedding 모델은 Note Chat의{" "}
          <span className="font-medium">note-retrieval</span> 설정을 따릅니다.
        </p>
      </div>
    </div>
  );
}
