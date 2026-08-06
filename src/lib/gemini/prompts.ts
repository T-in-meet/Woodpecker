export type QuizType = "ox" | "blank" | "choice";

export const CHOICE_OPTION_COUNT = 4;

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 20;
const CHARS_PER_QUESTION = 300;

export type QuestionRange = {
  min: number;
  max: number;
};

/**
 * 노트 길이로 문항 수의 "안전 범위"만 정한다.
 * 실제 개수는 이 범위 안에서 Gemini가 노트 내용의 밀도를 보고 결정한다.
 * 길이는 셀 수 있지만 물어볼 거리가 몇 개인지는 내용을 읽어야 알 수 있기 때문이다.
 */
export function getQuestionRange(contentLength: number): QuestionRange {
  const cap = Math.min(
    Math.round(contentLength / CHARS_PER_QUESTION),
    MAX_QUESTIONS,
  );

  return { min: MIN_QUESTIONS, max: Math.max(cap, MIN_QUESTIONS) };
}

const QUESTION_COUNT_RULE = `3. \${minQuestions}~\${maxQuestions}문항 사이에서 생성하되, 개수는 노트 내용의 밀도에 따라 정하세요.
   - 시험 볼 가치가 있는 독립적인 사실·개념·수치가 많으면 상한에 가깝게 생성하세요.
   - 내용이 반복되거나 서술 위주라 물어볼 거리가 적으면 적게 생성하세요.
   - 개수를 채우기 위해 지엽적이거나 뻔한 문제를 억지로 만들지 마세요.`;

const QUIZ_TYPE_RULES: Record<QuizType, string> = {
  ox: `2. 모든 문제를 OX 퀴즈로 생성하세요.
${QUESTION_COUNT_RULE}
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
${QUESTION_COUNT_RULE}
4. 각 문제에 간단한 해설을 포함하세요.
5. 노트 원본 문장에서 핵심 키워드를 ____로 대체하세요.
6. acceptedAnswers에는 정답과 같은 뜻으로 인정할 표기를 빠짐없이 넣으세요.
   - 영어 원어와 한글 표기를 반드시 서로 포함하세요. (레지스터 → register / register → 레지스터)
   - 한글 음차 표기가 여럿이면 모두 넣으세요. (clock → 클럭, 클락, 클록)
   - 통용되는 약어와 정식 명칭을 함께 넣으세요. (데이터베이스 → DB, database / CPU → 중앙처리장치, central processing unit)
   - 같은 대상을 가리키는 다른 용어도 넣으세요. (주기억장치 → 메인 메모리, main memory)
   - 노트에 나오지 않는 표기라도 일반적으로 통용되면 넣으세요.
   - 대소문자, 띄어쓰기, 문장부호, 하이픈 차이는 채점에서 자동으로 무시되므로 그런 변형은 넣지 마세요.
   - 뜻이 달라지는 표기는 넣지 마세요. 정답으로 인정할 수 있는 것만 넣습니다.
7. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

## JSON 형식
{
  "questions": [
    {
      "type": "blank",
      "question": "____에 들어갈 단어가 포함된 문장",
      "answer": "레지스터",
      "acceptedAnswers": ["register", "레지스타"],
      "explanation": "해설"
    }
  ]
}`,
  choice: `2. 모든 문제를 ${CHOICE_OPTION_COUNT}지선다 객관식으로 생성하세요.
${QUESTION_COUNT_RULE}
4. 각 문제에 간단한 해설을 포함하세요.
5. options는 반드시 ${CHOICE_OPTION_COUNT}개이며, 정답 1개와 오답 ${CHOICE_OPTION_COUNT - 1}개로 구성하세요.
6. 오답은 노트 내용과 관련된 그럴듯한 내용으로 만들되 명백히 틀린 것이어야 합니다.
7. answer는 정답 선택지의 위치를 0부터 세는 번호로 적으세요.
   - 첫 번째 선택지가 정답이면 0, 마지막 선택지가 정답이면 ${CHOICE_OPTION_COUNT - 1}입니다.
   - 1부터 세지 마세요.
8. 정답 위치를 문제마다 고르게 분산시키세요. 특정 번호에 정답을 몰지 마세요.
9. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

## JSON 형식
{
  "questions": [
    {
      "type": "choice",
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
  questionRange: QuestionRange,
  quizType: QuizType,
): string {
  const rules = QUIZ_TYPE_RULES[quizType]
    .replace("${minQuestions}", String(questionRange.min))
    .replace("${maxQuestions}", String(questionRange.max));

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
