import { Check, X } from "lucide-react";

const beforeItems = [
  "공부한 내용을 며칠 뒤 까먹음",
  "복습 타이밍을 스스로 정해야 함",
  "노트 앱, 캘린더, 알림 따로 관리",
  "복습했는지 안 했는지 확인 어려움",
  "열심히 했는데 실력이 안 느는 느낌",
] as const;

const afterItems = [
  "과학적 간격으로 기억 유지",
  "1-3-7일 자동 복습 스케줄링",
  "기록부터 복습까지 한 곳에서",
  "백지 테스트로 진짜 기억인지 확인",
  "반복할수록 장기 기억으로 전환",
] as const;

const personas = [
  {
    emoji: "📖",
    description: "강의나 책을 읽고 나면 며칠 지나 기억이 나지 않는 분",
  },
  {
    emoji: "💻",
    description: "코딩 테스트·기술 면접을 앞두고 체계적인 복습이 필요한 개발자",
  },
  {
    emoji: "📈",
    description: "꾸준히 공부하지만 실력이 쌓이지 않는 것 같아 답답한 분",
  },
] as const;

export function ComparisonSection() {
  return (
    <section id="comparison">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          무엇이 다른가요?
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          기존 학습 vs 딱다구리
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Before */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 dark:border-red-900/30 dark:bg-red-950/20">
            <div className="mb-4 inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
              기존 학습
            </div>
            <ul className="space-y-3">
              {beforeItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <X className="mt-0.5 size-5 shrink-0 text-red-500" />
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* After */}
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 dark:border-green-900/30 dark:bg-green-950/20">
            <div className="mb-4 inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
              딱다구리
            </div>
            <ul className="space-y-3">
              {afterItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-5 shrink-0 text-green-500" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Target Audience */}
        <p className="mt-16 text-center text-sm font-medium text-muted-foreground">
          이런 고민이 있다면 딱다구리가 답입니다
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {personas.map((persona) => (
            <div
              key={persona.description}
              className="flex items-start gap-3 rounded-xl border bg-card p-5"
            >
              <span className="text-2xl">{persona.emoji}</span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {persona.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
