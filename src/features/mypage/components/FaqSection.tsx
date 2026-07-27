import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "복습 주기는 어떻게 되나요?",
    answer:
      "노트를 작성하면 1일 → 3일 → 7일 간격으로 총 3번의 복습을 하게 됩니다. 각 복습을 완료하면 다음 단계로 넘어가고, 마지막 복습까지 마치면 해당 노트의 복습이 종료됩니다.",
  },
  {
    question: "복습 알림은 언제 오나요?",
    answer:
      "노트 작성 시 설정한 알림 시각에 맞춰 복습 예정일에 알림을 보내드립니다. 알림을 받으려면 마이페이지 > 계정 관리에서 푸시 알림을 허용해주세요.",
  },
  {
    question: "복습을 놓치면 어떻게 되나요?",
    answer:
      "예정일이 지나도 복습 대기 노트에 계속 남아있으니 언제든 완료할 수 있습니다. 다만 학습 효과를 위해 가능하면 예정일에 맞춰 복습하는 것을 권장합니다.",
  },
  {
    question: "닉네임이나 프로필 사진은 어떻게 바꾸나요?",
    answer:
      "마이페이지 > 계정 관리에서 닉네임과 프로필 사진을 변경할 수 있습니다.",
  },
  {
    question: "회원 탈퇴는 어떻게 하나요?",
    answer:
      "마이페이지 > 계정 관리 하단의 회원 탈퇴 메뉴에서 진행할 수 있습니다. 탈퇴 시 작성한 노트를 포함한 모든 데이터가 삭제되며 복구할 수 없습니다.",
  },
  {
    question: "원하는 답변을 찾지 못했어요",
    answer:
      "1:1 문의 탭에서 건의사항이나 궁금한 점을 남겨주시면 확인 후 답변드리겠습니다.",
  },
];

export function FaqSection() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">자주 묻는 질문</h2>
      <Accordion type="single" collapsible>
        {FAQ_ITEMS.map((item, index) => (
          <AccordionItem key={item.question} value={`faq-${index}`}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
