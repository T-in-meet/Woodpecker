import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const faqs = [
  {
    question: "딱다구리는 무료인가요?",
    answer:
      "네. 현재 딱다구리의 주요 기능은 무료로 이용할 수 있습니다. 노트 작성, 복습 일정 관리, 백지 테스트 등 기본 학습 기능을 별도 결제 없이 사용할 수 있습니다.",
  },

  {
    question: "복습 일정은 어떻게 정해지나요?",
    answer:
      "노트를 저장하면 첫 복습 일정은 1일 뒤로 자동 설정됩니다. 이후 복습을 완료할 때마다 3일, 7일, 14일, 30일 순으로 간격이 늘어나며, 이후에는 30일 간격으로 반복됩니다. 같은 날 여러 번 복습해도 일정은 한 단계만 진행됩니다. 필요하면 노트별로 다음 복습 날짜와 알림 시간을 직접 조정할 수 있고, 언제든 기본 일정으로 되돌릴 수 있습니다.",
  },

  {
    question: "복습 알림은 어떻게 받나요?",
    answer:
      "알림을 지원하는 브라우저에서 푸시 알림을 켜고 권한을 허용하면 복습 시간이 되었을 때 알림을 받을 수 있습니다. 기기와 브라우저에 따라 지원 여부가 다를 수 있으며, 알림을 사용하지 않더라도 딱다구리 안에서 오늘 복습할 노트를 확인할 수 있습니다.",
  },

  {
    question: "어떤 내용을 기록할 수 있나요?",
    answer:
      "다시 떠올려야 하는 학습 내용이라면 무엇이든 기록할 수 있습니다. 프로그래밍 개념, 기술 면접 답변, 외국어 표현, 자격증·시험 요약처럼 반복해서 복습하고 싶은 내용을 자유롭게 정리해보세요. 마크다운, 코드 블록, 표, 체크리스트, 링크와 이미지 등을 활용할 수 있고, 관련된 노트끼리 연결해 함께 복습할 수도 있습니다.",
  },

  {
    question: "백지 테스트는 어떻게 진행되나요?",
    answer:
      "노트를 보지 않은 상태에서 기억나는 내용을 직접 작성한 뒤 원문과 비교하는 방식으로 진행됩니다. 필요하면 AI 채점을 요청해 빠뜨린 핵심 개념이나 원문과 다르게 기억한 부분을 확인할 수 있습니다. AI 채점은 복습 회차당 한 번 제공되며, 결과는 학습을 돕기 위한 참고용으로 활용해 주세요.",
  },

  {
    question: "모바일에서도 사용할 수 있나요?",
    answer:
      "네. 모바일 브라우저에서도 노트를 작성하고 복습할 수 있습니다. 대부분의 핵심 기능을 모바일에서도 사용할 수 있으며, 푸시 알림 지원 여부는 사용 중인 기기와 브라우저에 따라 달라질 수 있습니다.",
  },

  {
    question: "내 노트가 다른 사용자에게 공개되나요?",
    answer:
      "아니요. 작성한 노트는 다른 일반 사용자에게 공개되지 않습니다. 서비스 운영과 AI 기능 제공 과정에서 필요한 데이터 처리 방식은 개인정보처리방침에서 자세히 확인할 수 있습니다.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-20">
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
