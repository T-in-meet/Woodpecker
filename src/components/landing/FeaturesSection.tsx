import { CalendarCheck, FileCheck, NotebookPen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: NotebookPen,
    title: "기록",
    description:
      "마크다운과 코드 구문 강조를 지원하는 에디터로 학습 내용을 깔끔하게 기록하세요.",
  },
  {
    icon: CalendarCheck,
    title: "1-3-7 반복 스케줄링",
    description:
      "기록한 날을 기준으로 1일, 3일, 7일 뒤에 자동으로 복습 알림을 보내드려요.",
  },
  {
    icon: FileCheck,
    title: "백지 테스트",
    description:
      "빈 화면에 다시 작성해보고, 원문과 나란히 비교하며 기억을 확인하세요.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="bg-muted/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          읽고, 이해하고, 그래도 잊혀집니다
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          왜 딱다구리인가요?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          딱다구리는 같은 자리를 반복해 쪼아 마침내 나무에 구멍을 냅니다.
          <br className="hidden md:block" />
          기억도 마찬가지입니다. 반복 인출이 지식을 단단하게 만듭니다.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="size-6 text-primary" />
                </div>
                <CardTitle className="mt-3">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
