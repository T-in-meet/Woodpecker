export const landingDescription =
  "노트 기록부터 간격 반복 복습, 백지 테스트와 AI 피드백까지. 딱다구리에서 공부한 내용을 기록하고 꾸준히 복습하세요.";

export const heroContent = {
  title: "기록이 기억이 되는 공간",
  description:
    "공부한 내용을 노트로 남기고, 간격을 두고 다시 떠올려보세요.\n복습 알림부터 백지 테스트, AI 피드백까지 한곳에서.",
  ctaLabel: "무료로 시작하기",
} as const;

export const ctaContent = {
  title: "오늘의 기록을,\n내일의 기억으로",
  description:
    "공부한 내용을 노트로 남기고,\n딱다구리와 함께 꾸준히 복습해보세요.",
  ctaLabel: "무료로 시작하기",
} as const;

export const learningFlowContent = {
  heading: "오늘 공부한 내용,\n일주일 뒤에도 기억나시나요?",
  introduction:
    "간격을 두고 다시 떠올리는 연습,\n기록부터 복습까지 세 단계로 이어가세요.",
  scenes: [
    {
      step: "01",
      eyebrow: "기록",
      title: "기록하면,\n첫 복습 일정이 잡혀요",
      description:
        "노트를 저장하면 첫 복습 일정이 자동으로 잡힙니다. 복습을 완료하면 다음 일정이 이어져, 캘린더에 따로 적어두지 않아도 돼요.",
      reverse: false,
    },
    {
      step: "02",
      eyebrow: "알림",
      title: "복습할 때가 되면,\n알림으로 알려드려요",
      description:
        "오늘 복습할 노트를 확인해보세요. 지원하는 브라우저에서 알림을 켜두면 복습 일정에 맞춰 푸시 알림을 받을 수 있어요.",
      reverse: true,
    },
    {
      step: "03",
      eyebrow: "백지 테스트",
      title: "기억나는 내용을,\n직접 꺼내보세요",
      description:
        "기억나는 내용을 작성하고 제출한 뒤 원문과 비교해보세요. AI 채점을 요청하면 빠뜨린 개념과 원본과 다르게 기억한 내용을 확인할 수 있어요.",
      reverse: false,
    },
  ],
} as const;

export const learningToolsContent = {
  heading: "하나의 노트로, 여러 방식으로 공부하세요.",
  description:
    "기록한 내용을 문제로 풀고, 다른 노트와 연결하고, 궁금한 점을 질문해보세요.",
  tools: [
    {
      id: "quiz",
      label: "퀴즈",
      title: "문제로 풀며 이해를 확인하세요",
      description: "내 노트로 만든 퀴즈를 풀며 배운 내용을 점검해보세요.",
    },
    {
      id: "related-notes",
      label: "관련 노트",
      title: "비슷한 주제를 연결해 공부하세요",
      description:
        "관련된 노트를 직접 연결하거나 AI 추천을 받아 함께 살펴보세요.",
    },
    {
      id: "chat",
      label: "노트 챗봇",
      title: "내 기록에 질문하세요",
      description:
        "저장한 노트를 바탕으로 답변을 받고 참고한 노트를 확인하세요.",
    },
  ],
} as const;
