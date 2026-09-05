import { FileText, GitBranch, MessageCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { learningToolsContent } from "./content";
import { QuizPreview } from "./QuizPreview";

/**
 * 관련 노트 목록(`RelatedNoteItem`)의 정적 재현.
 * 항목 테두리·아이콘·출처 배지(직접 연결 = blue, AI 추천 = violet)를
 * 실제 화면과 맞춘다. 실제 항목에 붙는 수정·삭제 버튼은 다이얼로그를
 * 끌고 오므로 랜딩에서는 뺐다.
 */
function RelatedNotesPreview() {
  const related = [
    { title: "조작적 조건형성", origin: "직접 연결" },
    { title: "강화 계획", origin: "AI 추천" },
  ];

  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <FileText className="size-4 shrink-0" aria-hidden />
        고전적 조건형성
      </p>
      <div className="ml-2 space-y-2 border-l border-orange-200 pl-4">
        {related.map((item) => (
          <div key={item.title} className="rounded-lg border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.title}</span>
              </span>
              <Badge
                variant="secondary"
                className={
                  item.origin === "직접 연결"
                    ? "shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-100"
                    : "shrink-0 bg-violet-100 text-violet-700 hover:bg-violet-100"
                }
              >
                {item.origin}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 노트 챗봇 대화(`NoteChatUserMessage`·`NoteChatAssistantMessage`·
 * `NoteChatReferenceNotes`)의 정적 재현. 답변 말풍선은 실제로 마크다운을
 * 렌더하지만 여기서는 문단 하나면 충분해 ReactMarkdown을 끌어오지 않는다.
 */
function ChatPreview() {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-7 text-primary-foreground">
          클로저와 스코프는 어떤 관계야?
        </div>
      </div>

      <div className="w-full space-y-3 rounded-lg border bg-muted/30 px-4 py-4">
        <p className="text-sm leading-7">
          노트에 따르면 클로저는 함수가 만들어진 위치의 스코프를 기억합니다.
          렉시컬 스코프가 그 기억의 기준이 됩니다.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        {["클로저(Closure)란?", "렉시컬 스코프"].map((title) => (
          <span
            key={title}
            className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium"
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{title}</span>
          </span>
        ))}
      </div>
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
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
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
                <div className="rounded-xl border bg-muted/20 p-4">
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
