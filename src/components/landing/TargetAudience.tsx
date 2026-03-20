import { Card, CardContent } from "@/components/ui/card";

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

export function TargetAudience() {
  return (
    <section className="bg-muted/50">
      <div className="mx-auto max-w-5xl px-6 py-20 md:py-28">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          이런 분들께 딱다구리를 추천합니다
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {personas.map((persona) => (
            <Card key={persona.description}>
              <CardContent className="pt-6">
                <span className="text-3xl">{persona.emoji}</span>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {persona.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
