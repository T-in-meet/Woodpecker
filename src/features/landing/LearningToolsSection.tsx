import {
  Check,
  FileText,
  GitBranch,
  MessageCircle,
  Sparkles,
} from "lucide-react";

import { learningToolsContent } from "./content";

function QuizPreview() {
  return (
    <div className="space-y-4 text-sm">
      <p className="font-medium leading-relaxed">
        클로저는 외부 함수가 종료된 후에도 해당 함수의 변수에 접근할 수 있다.
      </p>
      <div className="flex gap-2" aria-label="정답 예시: O">
        <span className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-orange-300 bg-orange-50 py-2 font-medium dark:border-orange-800 dark:bg-orange-950/40">
          <Check className="size-4" aria-hidden="true" /> O
        </span>
        <span className="flex-1 rounded-lg border py-2 text-center text-muted-foreground">
          X
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        클로저는 함수가 생성될 때의 렉시컬 환경을 기억해요.
      </p>
    </div>
  );
}

function RelatedNotesPreview() {
  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        클로저(Closure)란?
      </p>
      <div className="ml-2 space-y-3 border-l border-orange-200 pl-4 dark:border-orange-900">
        <p className="rounded-lg border bg-card px-3 py-2.5">렉시컬 스코프</p>
        <p className="rounded-lg border bg-card px-3 py-2.5">
          함수와 실행 컨텍스트
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        관련 개념을 함께 살펴보세요.
      </p>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="space-y-3 text-sm">
      <p className="ml-5 rounded-xl bg-muted px-3 py-2.5">
        클로저와 스코프는 어떤 관계야?
      </p>
      <p className="leading-relaxed">
        노트에 따르면 클로저는 함수가 생성된 위치의 스코프를 기억해요. 렉시컬
        스코프 노트와 함께 살펴보세요.
      </p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
        참고 노트 · 클로저, 렉시컬 스코프
      </p>
    </div>
  );
}

const previews = {
  quiz: { icon: Sparkles, content: <QuizPreview /> },
  "related-notes": { icon: GitBranch, content: <RelatedNotesPreview /> },
  chat: { icon: MessageCircle, content: <ChatPreview /> },
};

export function LearningToolsSection() {
  return (
    <section aria-labelledby="learning-tools-heading" className="bg-muted/30">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-20">
        <h2
          id="learning-tools-heading"
          className="break-keep text-center text-3xl font-bold tracking-tight md:text-4xl"
        >
          {learningToolsContent.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center leading-relaxed text-muted-foreground">
          {learningToolsContent.description}
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {learningToolsContent.tools.map((tool) => {
            const { icon: Icon, content } = previews[tool.id];
            return (
              <article
                key={tool.id}
                className="flex flex-col rounded-2xl border bg-card p-5"
              >
                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                  {tool.label}
                </p>
                <h3 className="mt-3 break-keep text-xl font-semibold tracking-tight">
                  {tool.title}
                </h3>
                <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
                <div className="mt-auto rounded-xl border bg-muted/20 p-4">
                  <p className="mb-3 text-xs text-muted-foreground">
                    학습 예시
                  </p>
                  {content}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
