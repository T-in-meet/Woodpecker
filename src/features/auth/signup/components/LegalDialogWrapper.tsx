"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import * as React from "react";

import type { LegalSection } from "@/components/legal/LegalContent";
import { privacySections } from "@/components/legal/PrivacySections";
import { termsSections } from "@/components/legal/TermsSections";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AgreementType = "termsOfService" | "privacyPolicy";

type LegalDialogWrapperProps = {
  agreementType: AgreementType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
  triggerLabel: string;
  dialogTitle: string;
  checkboxRef?: React.RefObject<HTMLButtonElement | null>;
  openedByLabel?: boolean;
};

/**
 * LegalDialogWrapper: 법적 동의 모달 UI 컴포넌트
 *
 * 책임:
 * - Radix Dialog 기반의 모달 UI 렌더링
 * - 법적 콘텐츠(약관/개인정보) 렌더링
 * - "동의하기" 버튼 → onAgree 콜백
 * - focus restore fallback 처리 (Label 클릭 경유 시)
 *
 * 제외:
 * - form state 관리 (SignupForm의 책임)
 * - openedByLabel 상태 관리 (SignupForm에서 주입)
 */
export function LegalDialogWrapper({
  agreementType,
  open,
  onOpenChange,
  onAgree,
  triggerLabel,
  dialogTitle,
  checkboxRef,
  openedByLabel = false,
}: LegalDialogWrapperProps) {
  // 콘텐츠 섹션 선택
  // 이유: agreementType에 따라 다른 법적 문서를 표시하기 위해 분기
  const contentSections: LegalSection[] =
    agreementType === "termsOfService" ? termsSections : privacySections;

  // focus restore fallback 처리
  // 이유: Radix Dialog 기본 복원은 Dialog.Trigger 기반
  //       Label은 non-focusable이므로 포커스 손실 발생
  //       → openedByLabel=true일 때 checkboxRef로 명시적 복원
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && openedByLabel && checkboxRef?.current) {
      // 비동기로 실행하여 Dialog 닫힘 애니메이션 완료 후 포커스 이동
      requestAnimationFrame(() => {
        checkboxRef.current?.focus();
      });
    }
    onOpenChange(nextOpen);
  };

  const handleAgree = () => {
    onAgree();
    onOpenChange(false);
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={handleOpenChange} modal={true}>
      <RadixDialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="bg-blue-400 text-white"
        >
          {triggerLabel}
        </Button>
      </RadixDialog.Trigger>

      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-background p-6 shadow-lg"
          aria-describedby={`${agreementType}-description`}
        >
          <RadixDialog.Title className="text-lg font-semibold mb-4">
            {dialogTitle}
          </RadixDialog.Title>

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
              <RadixDialog.Close asChild>
                <Button type="button" variant="ghost">
                  닫기
                </Button>
              </RadixDialog.Close>
              <Button
                type="button"
                onClick={handleAgree}
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                동의하기
              </Button>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
