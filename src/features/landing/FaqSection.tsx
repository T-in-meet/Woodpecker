import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const faqs = [
  {
    question: "딱다구리는 무료인가요?",
    answer: "현재 딱다구리는 무료로 이용할 수 있습니다.",
  },
  {
    question: "복습 일정은 어떻게 정해지나요?",
    answer:
      "노트를 저장하면 첫 복습은 1일 뒤로 잡힙니다. 이후 복습한 날짜 수에 따라 다음 복습까지의 간격이 3일, 7일, 14일, 30일로 늘어나며, 이후에는 30일 간격을 반복합니다. 같은 날 여러 번 복습해도 간격은 한 단계만 진행합니다. 학습 완료로 표시하면 해당 노트의 복습을 마칠 수 있습니다.",
  },
  {
    question: "복습 알림은 어떻게 받나요?",
    answer:
      "푸시 알림을 지원하는 브라우저에서 알림을 켜고 권한을 허용하면 받을 수 있습니다. 기기와 브라우저에 따라 지원 여부가 다를 수 있으며, 알림을 켜지 않아도 서비스에서 복습할 노트를 확인할 수 있습니다.",
  },
  {
    question: "어떤 내용을 기록할 수 있나요?",
    answer:
      "프로그래밍 개념, 기술 면접 답변, 외국어, 자격증 공부 등 암기가 필요한 모든 학습 내용을 기록할 수 있습니다. 마크다운과 코드 구문 강조를 지원합니다.",
  },
  {
    question: "백지 테스트는 어떻게 진행되나요?",
    answer:
      "백지 테스트에서 기억나는 내용을 작성하고 제출하면 원문과 비교할 수 있습니다. AI 채점을 요청해 빠뜨린 개념과 원본과 다르게 기억한 내용을 확인할 수도 있습니다. AI 채점은 복습 회차당 한 번 제공되며, 결과는 참고용입니다.",
  },
  {
    question: "모바일에서도 사용할 수 있나요?",
    answer:
      "모바일 브라우저에서도 노트를 작성하고 복습할 수 있습니다. 푸시 알림 지원 여부는 기기와 브라우저에 따라 다릅니다.",
  },
  {
    question: "내 노트가 다른 사용자에게 공개되나요?",
    answer:
      "노트는 다른 일반 사용자에게 공개되지 않습니다. 서비스 운영과 AI 기능 제공을 위한 데이터 처리 내용은 개인정보처리방침에서 확인할 수 있습니다.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          자주 묻는 질문
        </h2>

        {/* 위 기능 섹션보다 글자가 작아 페이지가 갑자기 좁아 보이던 문제가
            있어, 질문 줄만 한 단계 키우고 행 높이(기본 py-2.5)도 덮는다. */}
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.question} value={`item-${index}`}>
              <AccordionTrigger className="py-3.5 text-left text-base font-medium">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* 문의 박스는 FAQ와 최종 CTA 사이의 보조 안내다. 셋이 같은 강도로
            이어지지 않도록 글자를 낮춰 둔다. */}
        <div className="mt-12 rounded-xl border bg-card p-5 text-center text-sm text-muted-foreground">
          <p>찾으시는 답변이 없으신가요?</p>
          <p>궁금한 점이 있으시다면 언제든 연락주세요.</p>
          {/*
            좁은 화면에서 이메일 한 덩어리가 안 들어가면 브라우저가 아무 데서나
            끊어 "...gmail.co / m"처럼 보인다. 각 조각을 nowrap으로 묶고 그
            사이에만 <wbr>로 끊을 자리를 줘서 골뱅이 뒤에서만 넘어가게 한다.
          */}
          <p className="mt-2 font-medium text-foreground">
            <span className="whitespace-nowrap">woodpecker.dev.team@</span>
            <wbr />
            <span className="whitespace-nowrap">gmail.com</span>
          </p>
        </div>
      </div>
    </section>
  );
}
