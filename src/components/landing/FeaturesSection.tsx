import { BrainCircuit, Sparkles, Target } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: BrainCircuit,
    title: "인출 기반 학습",
    description:
      "단순히 다시 읽는 것이 아니라, 백지 상태에서 직접 떠올리는 과정이 기억을 강화합니다. 인출 연습은 재독보다 기억 유지율이 50% 이상 높습니다.",
  },
  {
    icon: Target,
    title: "최적의 복습 타이밍",
    description:
      "에빙하우스 망각곡선에 기반한 1-3-7일 간격으로, 잊혀지기 직전에 복습합니다. 같은 시간을 투자해도 기억에 남는 양이 다릅니다.",
  },
  {
    icon: Sparkles,
    title: "흩어진 도구를 하나로",
    description:
      "노트 앱에 기록하고, 캘린더에 일정 잡고, 알림을 따로 설정하던 번거로움. 기록부터 복습까지 한 곳에서 완결됩니다.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="bg-muted/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <p className="text-center text-sm font-medium text-muted-foreground">
          학습의 새로운 기준
        </p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl">
          왜 딱다구리인가요?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          딱다구리는 같은 자리를 반복적으로 쪼아 마침내 나무에 구멍을 냅니다.
          <br />한 번 쪼아서는 구멍이 나지 않듯, 기억도 반복해야 깊이
          새겨집니다.
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
