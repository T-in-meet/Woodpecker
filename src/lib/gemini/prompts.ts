export type QuizType = "ox" | "blank" | "multiple_choice";

export function getQuestionCount(contentLength: number): number {
  if (contentLength <= 300) return 3;
  if (contentLength <= 700) return 5;
  return 7;
}

const QUIZ_TYPE_RULES: Record<QuizType, string> = {
  ox: `2. 모든 문제를 OX 퀴즈로 생성하세요.
3. 총 \${questionCount}문항을 생성하세요.
4. 각 문제에 간단한 해설을 포함하세요.
5. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

## JSON 형식
{
  "questions": [
    {
      "type": "ox",
      "question": "문제 문장",
      "answer": true 또는 false,
      "explanation": "해설"
    }
  ]
}`,
  blank: `2. 모든 문제를 빈칸 채우기로 생성하세요.
3. 총 \${questionCount}문항을 생성하세요.
4. 각 문제에 간단한 해설을 포함하세요.
5. 노트 원본 문장에서 핵심 키워드를 ____로 대체하세요.
6. 빈칸 채우기는 허용 가능한 별칭(acceptedAnswers)도 포함하세요.
7. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

## JSON 형식
{
  "questions": [
    {
      "type": "blank",
      "question": "____에 들어갈 단어가 포함된 문장",
      "answer": "정답 키워드",
      "acceptedAnswers": ["허용 별칭1", "허용 별칭2"],
      "explanation": "해설"
    }
  ]
}`,
  multiple_choice: `2. 모든 문제를 4지선다 객관식으로 생성하세요.
3. 총 \${questionCount}문항을 생성하세요.
4. 각 문제에 간단한 해설을 포함하세요.
5. 선택지(options)는 반드시 4개여야 합니다.
6. answer는 정답 선택지의 인덱스(0~3)입니다.
7. 오답 선택지는 그럴듯하지만 명확히 틀린 내용으로 작성하세요.
8. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

## JSON 형식
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "문제 문장",
      "options": ["선택지1", "선택지2", "선택지3", "선택지4"],
      "answer": 0,
      "explanation": "해설"
    }
  ]
}`,
};

export function buildQuizPrompt(
  noteTitle: string,
  noteContent: string,
  questionCount: number,
  quizType: QuizType,
): string {
  const rules = QUIZ_TYPE_RULES[quizType].replace(
    "${questionCount}",
    String(questionCount),
  );

  return `당신은 학습 퀴즈 생성 전문가입니다.
아래 노트 내용을 바탕으로 퀴즈를 생성하세요.

## 규칙
1. 반드시 노트 내용 안에서만 문제를 만드세요. 노트에 없는 내용을 추가하지 마세요.
   - 노트 내용이 사실과 다르더라도 노트에 적힌 내용만을 정답 기준으로 삼으세요.
   - 외부 지식이나 일반 상식으로 노트 내용을 보정하거나 수정하지 마세요.
   - 정답과 해설 모두 노트 원문에 근거해야 합니다.
${rules}

## 노트 제목
${noteTitle}

## 노트 내용
${noteContent}`;
}
