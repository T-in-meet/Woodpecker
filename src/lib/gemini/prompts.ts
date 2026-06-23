export function getQuestionCount(contentLength: number): number {
  if (contentLength <= 300) return 3;
  if (contentLength <= 700) return 5;
  return 7;
}

export function buildQuizPrompt(
  noteTitle: string,
  noteContent: string,
  questionCount: number,
): string {
  return `당신은 학습 퀴즈 생성 전문가입니다.
아래 노트 내용을 바탕으로 퀴즈를 생성하세요.

## 규칙
1. 반드시 노트 내용 안에서만 문제를 만드세요. 노트에 없는 내용을 추가하지 마세요.
2. OX 퀴즈와 빈칸 채우기를 적절히 혼합하세요.
3. 총 ${questionCount}문항을 생성하세요.
4. 각 문제에 간단한 해설을 포함하세요.
5. 빈칸 채우기의 정답은 핵심 키워드여야 합니다.
6. 빈칸 채우기는 허용 가능한 별칭(acceptedAnswers)도 포함하세요.
7. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

## JSON 형식
{
  "questions": [
    {
      "type": "ox",
      "question": "문제 문장",
      "answer": true 또는 false,
      "explanation": "해설"
    },
    {
      "type": "blank",
      "question": "____에 들어갈 단어가 포함된 문장",
      "answer": "정답 키워드",
      "acceptedAnswers": ["허용 별칭1", "허용 별칭2"],
      "explanation": "해설"
    }
  ]
}

## 노트 제목
${noteTitle}

## 노트 내용
${noteContent}`;
}
