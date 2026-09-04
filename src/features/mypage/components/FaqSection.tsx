"use client";

import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

const FAQ_CATEGORIES = [
  { id: "learning", label: "복습과 학습" },
  { id: "notifications", label: "알림과 일정" },
  { id: "notes", label: "노트 관리" },
  { id: "account", label: "계정 관리" },
] as const;

type FaqCategoryId = (typeof FAQ_CATEGORIES)[number]["id"];

type FaqItem = {
  category: FaqCategoryId;
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    category: "learning",
    question: "복습 주기는 어떻게 되나요?",
    answer:
      "노트를 작성하면 1일 뒤 첫 복습이 시작되고, 이후에는 3일 → 7일 → 14일 → 30일 간격으로 복습합니다. 30일 단계 이후에도 같은 간격으로 계속 이어지며, 복습 횟수에 따른 자동 종료는 없습니다. 학습을 마치고 싶다면 노트 상세 화면의 ⋯ 메뉴에서 '복습 완료로 표시'를 선택할 수 있고, 필요할 때 다시 시작할 수 있습니다.",
  },
  {
    category: "learning",
    question: "백지 테스트는 어떻게 진행되나요?",
    answer:
      "복습할 노트에서 백지 테스트를 시작하면 빈 편집기가 나타납니다. 기억나는 대로 답안을 작성하고 '원본과 비교하기'를 누르면 원본과 나란히 확인할 수 있습니다. 원한다면 이 화면에서 AI 채점을 받을 수 있고, 마지막에 '복습 완료'를 누르면 다음 복습 일정이 잡힙니다.",
  },
  {
    category: "learning",
    question: "하루에 여러 회차를 몰아서 복습할 수 있나요?",
    answer:
      "같은 노트를 하루에 여러 번 완료할 수는 있지만, 복습 간격은 그날 한 번 복습한 것으로만 계산됩니다. 같은 날 추가로 완료해도 다음 복습 일정은 더 뒤로 밀리지 않습니다.",
  },
  {
    category: "notifications",
    question: "복습 알림은 언제 오나요?",
    answer:
      "기본적으로 노트를 작성한 시각을 기준으로 1일 뒤 같은 시각에 첫 알림이 갑니다. 이후 회차도 복습을 완료한 시점을 기준으로 예정일이 잡힙니다. 알림을 받으려면 마이페이지 > 계정 관리에서 푸시 알림을 허용해주세요.",
  },
  {
    category: "notifications",
    question: "복습 날짜나 알림 시각을 바꿀 수 있나요?",
    answer:
      "노트 상세 화면 오른쪽 위의 ⋯ 메뉴에서 '복습 일정 변경'을 선택하면 다음 복습 날짜와 알림 시각을 직접 지정할 수 있습니다. 날짜를 옮기면 현재 예정된 복습 일정이 함께 이동합니다. 복습 완료로 표시한 노트는 '복습 다시 시작'을 선택해 알림과 복습을 이어갈 수 있습니다.",
  },
  {
    category: "notifications",
    question: "알림을 허용했는데 알림이 오지 않아요",
    answer:
      "푸시 알림 허용은 기기와 브라우저 단위로 저장됩니다. 다른 기기나 다른 브라우저에서도 알림을 받으려면 그 환경에서 다시 마이페이지 > 계정 관리에 들어가 알림을 켜주세요. 이전에 브라우저에서 알림을 '차단'했다면 브라우저의 사이트 설정에서 먼저 차단을 해제해야 다시 켤 수 있습니다.",
  },
  {
    category: "learning",
    question: "복습을 놓치면 어떻게 되나요?",
    answer:
      "예정일이 지나도 복습 대기 노트에 계속 남아있으니 언제든 완료할 수 있습니다. 다만 학습 효과를 위해 가능하면 예정일에 맞춰 복습하는 것을 권장합니다.",
  },
  {
    category: "notes",
    question: "노트를 수정하면 복습 일정이 초기화되나요?",
    answer:
      "아니요. 노트를 수정해도 지금까지 진행한 복습 회차와 예정된 일정은 그대로 유지됩니다. 다만 백지 테스트의 비교 대상과 AI 채점 기준은 항상 최신 본문이라, 답안을 작성하는 도중에 본문을 고치면 채점이 중단될 수 있습니다.",
  },
  {
    category: "notes",
    question: "노트 길이에 제한이 있나요?",
    answer:
      "제목은 100자, 본문은 50,000자까지 저장할 수 있습니다. 백지 테스트 답안도 50,000자까지 작성할 수 있습니다.",
  },
  {
    category: "learning",
    question: "AI 채점은 하루에 몇 번까지 받을 수 있나요?",
    answer:
      "하루에 5회까지 받을 수 있고, 사용 횟수는 매일 자정(한국 시간)에 초기화됩니다. 한도를 다 쓰더라도 백지 테스트와 복습 완료는 그대로 할 수 있고, 지난 채점 기록도 계속 볼 수 있습니다.",
  },
  {
    category: "learning",
    question: "AI 채점 점수가 낮으면 복습이 인정되지 않나요?",
    answer:
      "아니요. AI 채점은 얼마나 기억하고 있는지 참고하기 위한 기능이라 점수와 상관없이 복습을 완료할 수 있습니다. 채점을 받지 않고 원본과 비교만 한 뒤 복습을 완료해도 다음 회차로 넘어갑니다.",
  },
  {
    category: "learning",
    question: "AI 채점 결과는 다시 볼 수 있나요?",
    answer:
      "네, 노트 상세 화면의 '회차별 AI 채점 기록'에서 회차마다 받은 100점 만점 점수와 요약, 놓친 개념을 다시 확인할 수 있습니다.",
  },
  {
    category: "learning",
    question: "학습 통계의 연속 학습일과 정시 완료율은 어떻게 계산되나요?",
    answer:
      "모두 한국 시간 기준입니다. 연속 학습일은 복습을 완료한 날이 하루도 끊기지 않고 이어진 일수로, 오늘 아직 복습하지 않았어도 어제까지 이어졌다면 기록이 유지됩니다. 정시 완료율은 완료한 복습 중 예정일 당일까지 마친 비율이며, 잔디 그래프는 최근 30일의 복습 완료 건수를 보여줍니다.",
  },
  {
    category: "account",
    question: "닉네임이나 프로필 사진은 어떻게 바꾸나요?",
    answer:
      "마이페이지 > 계정 관리에서 닉네임과 프로필 사진을 변경할 수 있습니다.",
  },
  {
    category: "account",
    question: "소셜 로그인으로 가입했는데 비밀번호를 쓸 수 있나요?",
    answer:
      "마이페이지 > 계정 관리에서 비밀번호를 설정하면 이메일과 비밀번호로도 로그인할 수 있습니다. 설정한 뒤에는 같은 화면에서 언제든 변경할 수 있습니다.",
  },
  {
    category: "account",
    question: "회원 탈퇴는 어떻게 하나요?",
    answer:
      "마이페이지 > 계정 관리 하단의 회원 탈퇴 메뉴에서 진행할 수 있습니다. 탈퇴 시 작성한 노트를 포함한 모든 데이터가 삭제되며 복구할 수 없습니다.",
  },
];

export function FaqSection() {
  const [selectedCategory, setSelectedCategory] =
    useState<FaqCategoryId>("learning");
  const selectedItems = FAQ_ITEMS.filter(
    (item) => item.category === selectedCategory,
  );

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">자주 묻는 질문</h2>
      <div
        role="group"
        aria-label="FAQ 유형"
        className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        {FAQ_CATEGORIES.map((category) => {
          const isSelected = selectedCategory === category.id;

          return (
            <Button
              key={category.id}
              id={`faq-tab-${category.id}`}
              type="button"
              variant="ghost"
              className={cn(
                "w-full rounded-full px-4 sm:w-auto",
                isSelected
                  ? "border-black bg-black text-white hover:bg-black hover:text-white dark:border-black dark:bg-black dark:text-white dark:hover:bg-black dark:hover:text-white"
                  : "border-border bg-background text-foreground hover:bg-muted hover:text-foreground dark:border-border dark:bg-background dark:text-foreground dark:hover:bg-muted/50 dark:hover:text-foreground",
              )}
              aria-controls="faq-panel"
              aria-pressed={isSelected}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </Button>
          );
        })}
      </div>

      <div
        id="faq-panel"
        role="region"
        aria-labelledby={`faq-tab-${selectedCategory}`}
      >
        <Accordion key={selectedCategory} type="single" collapsible>
          {selectedItems.map((item, index) => (
            <AccordionItem
              key={item.question}
              value={`${selectedCategory}-${index}`}
            >
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
