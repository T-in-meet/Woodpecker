"use client";

import * as React from "react";

import type { LegalSection } from "@/components/legal/LegalContent";
import { privacySections } from "@/components/legal/PrivacySections";
import { termsSections } from "@/components/legal/TermsSections";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";

type AgreementType = "termsOfService" | "privacyPolicy";

type LegalDialogWrapperProps = {
  agreementType: AgreementType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
  triggerLabel: string;
  dialogTitle: string;
  triggerButtonRef?: React.RefObject<HTMLButtonElement | null>;
  onTriggerClick?: () => void;
};

/**
 * LegalDialogWrapper: 법적 동의 모달 UI 컴포넌트
 *
 * 책임:
 * - Radix Dialog 기반의 모달 UI 렌더링
 * - 법적 콘텐츠(약관/개인정보) 렌더링
 * - "동의하기" 버튼 → onAgree 콜백
 *
 * 제외:
 * - form state 관리 (SignupForm의 책임)
 * - 모달 닫힘 후 focus restore 정책 (SignupForm의 책임)
 */
export function LegalDialogWrapper({
  agreementType,
  open,
  onOpenChange,
  onAgree,
  triggerLabel,
  dialogTitle,
  triggerButtonRef,
  onTriggerClick,
}: LegalDialogWrapperProps) {
  // 콘텐츠 섹션 선택
  // 이유: agreementType에 따라 다른 법적 문서를 표시하기 위해 분기
  const contentSections: LegalSection[] =
    agreementType === "termsOfService" ? termsSections : privacySections;

  const handleAgree = () => {
    onAgree();
    // "동의하기" 경로도 일반 닫기와 동일한 포커스 복원 규칙을 따르도록 통일
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogTrigger asChild>
        <Button
          ref={triggerButtonRef}
          type="button"
          variant="ghost"
          size="sm"
          className="bg-black text-white"
          onClick={onTriggerClick}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="flex max-h-[85vh] flex-col overflow-hidden"
        aria-describedby={`${agreementType}-description`}
        onCloseAutoFocus={(event) => {
          // SignupForm에서 트리거/동의 경로별로 포커스를 명시적으로 제어하므로
          // Radix 기본 복원(DialogTrigger 포커스)은 차단한다.
          event.preventDefault();
        }}
      >
        <DialogTitle className="mb-4">{dialogTitle}</DialogTitle>

        {/* 스크린리더용 설명 텍스트 */}
        <div id={`${agreementType}-description`} className="sr-only">
          {dialogTitle} 전문을 확인하고 동의할 수 있습니다.
        </div>

        {/* 법적 콘텐츠 — 스크롤 가능한 영역 */}
        <div className="relative mb-4 min-h-0 flex-1 overflow-y-auto">
          <div className="prose dark:prose-invert max-w-none space-y-6">
            {contentSections.map((section) => (
              <div key={section.article}>
                <h3 className="text-base font-semibold">
                  {section.article} {section.title}
                </h3>
                <div className="text-sm text-muted-foreground">
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          {/* 스크롤 힌트: 하단 gradient overlay */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-16",
              "bg-linear-to-t from-background to-transparent",
            )}
            aria-hidden="true"
          />
        </div>

        {/* 푸터: 동작 버튼 */}
        <div className="sticky bottom-0 z-10 -mx-6 border-t bg-background px-6 pt-4">
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                닫기
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleAgree}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              동의하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
