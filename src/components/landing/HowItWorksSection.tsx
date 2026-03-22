import { Bell, FileCheck, NotebookPen } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: NotebookPen,
    title: "기록하기",
    description: "학습한 내용을 마크다운 에디터로 기록합니다.",
    descriptionExtra: "코드, 개념, 요약 등 자유롭게 작성하세요.",
  },
  {
    number: "02",
    icon: Bell,
    title: "알림 받기",
    description: "1일, 3일, 7일 뒤에 자동으로 복습 알림을 받습니다.",
    descriptionExtra: "잊어버리기 직전에 딱 맞춰 알려드려요.",
  },
  {
    number: "03",
    icon: FileCheck,
    title: "백지 테스트",
    description: "빈 화면에 기억나는 대로 다시 작성하고,",
    descriptionExtra: "원문과 비교하며 기억을 확인합니다.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          간단한 3단계
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          딱 세 번이면 됩니다
        </h2>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.number} className="relative text-center">
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="absolute right-0 top-8 hidden h-px w-full translate-x-1/2 bg-border md:block" />
              )}

              <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <step.icon className="size-7 text-primary" />
                <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {step.number}
                </span>
              </div>

              <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
                <br className="md:hidden" />
                <span className="hidden md:inline"> </span>
                {step.descriptionExtra}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
