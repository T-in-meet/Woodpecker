export const heroContent = {
  title: "기록이 기억이 되는 공간",
  description:
    "기록한 순간부터 복습이 설계됩니다.\n노트 기록부터 복습 알림, 백지 테스트까지 한 곳에서.",
  ctaLabel: "무료로 시작하기",
} as const;

export const ctaContent = {
  title: "지금 바로 시작하세요",
  description:
    "기록만 하세요.\n기억은 딱다구리가 책임집니다\n무료로 시작하고 학습 효과를 직접 경험하세요.",
  ctaLabel: "무료로 시작하기",
} as const;

export const learningFlowContent = {
  heading: "오늘 공부한 내용,\n일주일 뒤에도 기억나시나요?",
  stats: [
    {
      value: "67%",
      label: "학습 후 24시간 내 망각되는 정보량",
      source: "Ebbinghaus (1885)",
    },
    {
      value: "+50%",
      label: "인출 연습 시 1주일 후 기억 유지량 증가",
      source: "Karpicke & Blunt (2011)",
    },
  ],
  scenes: [
    {
      step: "01",
      eyebrow: "기록",
      title: "적는 순간,\n복습이 설계됩니다",
      description:
        "노트를 저장하는 순간, 복습 일정이 자동으로 잡힙니다. 캘린더를 따로 쓰거나 알림을 설정할 필요 없어요. 기록만 하면 딱다구리가 나머지를 챙깁니다.",
      reverse: false,
    },
    {
      step: "02",
      eyebrow: "알림",
      title: "잊어버리기 직전,\n딱 맞춰 알려드려요",
      description:
        "복습은 '해야지' 생각만으로는 잘 안 됩니다. 간격을 두고 반복할수록 기억이 오래 간다는 건 인지과학이 검증한 원리입니다. 딱다구리가 딱 그 타이밍에 먼저 찾아갑니다.",
      reverse: true,
    },
    {
      step: "03",
      eyebrow: "백지 테스트",
      title: "다시 읽는 게 아니라,\n직접 꺼내야 기억됩니다",
      description:
        "빈 화면에 기억나는 대로 써보세요. 작성 후 원문과 나란히 비교하며 실제로 내가 알고 있는지 확인할 수 있습니다.",
      reverse: false,
    },
  ],
} as const;
