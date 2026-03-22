import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "딱다구리는 무료인가요?",
    answer:
      "네, 현재 베타 기간 동안 모든 기능을 무료로 사용할 수 있습니다. 정식 출시 후에도 기본 기능은 무료로 유지할 예정입니다.",
  },
  {
    question: "1-3-7 복습이 정말 효과가 있나요?",
    answer:
      "간격 반복(Spaced Repetition)은 인지과학에서 가장 잘 검증된 학습 방법 중 하나입니다. 에빙하우스의 망각곡선 연구에 기반하여, 잊혀지기 직전에 복습하면 기억 유지율이 크게 높아집니다.",
  },
  {
    question: "어떤 내용을 기록할 수 있나요?",
    answer:
      "프로그래밍 개념, 기술 면접 답변, 외국어, 자격증 공부 등 암기가 필요한 모든 학습 내용을 기록할 수 있습니다. 마크다운과 코드 구문 강조를 지원합니다.",
  },
  {
    question: "백지 테스트는 어떻게 진행되나요?",
    answer:
      "복습 알림을 받으면 빈 화면이 나타나고, 기억나는 대로 내용을 작성합니다. 작성 후 원본과 나란히 비교하며 얼마나 기억하고 있는지 스스로 확인할 수 있습니다.",
  },
  {
    question: "모바일에서도 사용할 수 있나요?",
    answer:
      "네, 웹 기반 서비스로 모바일 브라우저에서도 사용할 수 있습니다. 반응형 디자인으로 모바일 환경에 최적화되어 있습니다.",
  },
  {
    question: "데이터는 안전하게 보관되나요?",
    answer:
      "모든 데이터는 클라우드에 암호화되어 저장됩니다. 계정별로 격리되어 있어 본인만 접근할 수 있습니다.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq">
      <div className="mx-auto max-w-3xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          궁금한 점이 있으신가요?
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          자주 묻는 질문
        </h2>

        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-sm font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
