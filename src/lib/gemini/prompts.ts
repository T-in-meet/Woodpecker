export type QuizType = "ox" | "blank" | "multiple_choice";

// 프롬프트를 수정할 때마다 값을 올려서 기존 캐시된 퀴즈를 무효화하세요.
export const PROMPT_VERSION = "6";

export function getQuestionCount(contentLength: number): number {
  if (contentLength <= 300) return 3;
  if (contentLength <= 700) return 5;
  return 7;
}

// 노트는 마크다운으로 저장되므로 코드 블록은 ``` 펜스 형태다.
function hasCodeBlock(noteContent: string): boolean {
  return /^\s*```/m.test(noteContent);
}

const CODE_FOCUS_GUIDE = `## 추가 지침 (코드가 포함된 노트)
노트에 코드가 포함되어 있습니다. 코드를 이해했는지 확인할 수 있는 문제를 우선적으로 출제하세요.

우선 출제할 패턴:
- 실행 결과 예측: 코드나 표현식을 실행했을 때의 출력값·반환값을 묻는 문제 (노트에 결과가 적혀 있는 경우만)
- 문법 키워드: 코드에 쓰인 선언 키워드, 연산자, 제어문 등 문법 요소의 역할이나 차이를 묻는 문제
- 동작 원리: 노트에 설명된 코드의 동작 이유나 개념을 묻는 문제

출제하지 말아야 할 패턴:
- 임의의 리터럴 값 암기: "변수 count의 초기값은 ____이다"처럼 값 자체에 학습 의미가 없는 문제
- 변수·함수 이름 암기: "함수 이름은 ____이다"처럼 이름만 묻는 문제

좋은 예: "let count = 5; 에서 재할당이 가능한 선언 키워드는 ____이다." (답: let)
나쁜 예: "let count = 5; 에서 count에 할당된 값은 ____이다." (답: 5)`;

const QUIZ_TYPE_RULES: Record<QuizType, string> = {
  ox: `4. 모든 문제를 OX 퀴즈로 생성하세요.
5. 총 \${questionCount}문항을 생성하세요.
6. 각 문제에 간단한 해설을 포함하세요.
7. answer가 false인 문제는 노트 내용과 명확히 모순되는 지점이 정확히 하나 있어야 합니다. 노트 문장의 단어나 어순을 바꿨더라도 의미가 같으면 그 문장은 참(true)입니다. 주어와 목적어를 실제로 뒤바꾸거나, 수치·용어를 다른 것으로 교체하는 등 의미 자체가 달라져야 거짓 문제입니다.
8. answer가 false인 문제의 해설은 문제 문장의 어느 부분이 노트 내용과 다른지 반드시 구체적으로 지목하세요.
9. 각 문제를 완성한 뒤 스스로 검증하세요: 문제 문장이 노트 내용과 의미상 일치하면 answer는 반드시 true여야 합니다. 해설이 문제 문장과 같은 내용을 말하고 있다면 그 문제는 잘못 만들어진 것이므로 다시 작성하세요.
10. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

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
  blank: `4. 모든 문제를 빈칸 채우기로 생성하세요.
5. 총 \${questionCount}문항을 생성하세요.
6. 각 문제에 간단한 해설을 포함하세요.
7. 빈칸은 단순 변수명이나 임의의 숫자·문자열 리터럴처럼 암기 의미가 없는 값이 아니라, 개념 이해를 확인할 수 있는 핵심 요소를 대상으로 하세요. 예: 문법 키워드(var/let/const, 연산자 등), 함수나 표현식의 실행 결과(예: console.log 출력값), 자료형(type), 핵심 개념 용어.
8. 빈칸 채우기는 허용 가능한 별칭(acceptedAnswers)도 포함하세요.
9. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

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
  multiple_choice: `4. 모든 문제를 4지선다 객관식으로 생성하세요.
5. 총 \${questionCount}문항을 생성하세요.
6. 각 문제에 간단한 해설을 포함하세요.
7. 선택지(options)는 반드시 4개여야 합니다.
8. answer는 정답 선택지의 인덱스(0~3)입니다.
9. 오답 선택지는 그럴듯하지만 명확히 틀린 내용으로 작성하세요.
10. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트를 포함하지 마세요.

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
  const codeGuide = hasCodeBlock(noteContent) ? `\n${CODE_FOCUS_GUIDE}\n` : "";

  return `당신은 학습 퀴즈 생성 전문가입니다.
아래 노트 내용을 바탕으로 퀴즈를 생성하세요.

## 규칙
1. 반드시 노트 내용 안에서만 문제를 만드세요. 노트에 없는 내용을 추가하지 마세요.
2. 노트 내용에 사실 오류(예: 잘못된 수치, 틀린 정의 등)가 있어도 절대 임의로 수정하거나 실제 사실로 바로잡지 마세요. 노트에 적힌 내용을 그대로 정답 기준으로 삼으세요.
3. 당신이 알고 있는 배경지식이나 상식으로 정답을 판단하지 말고, 오직 노트에 명시된 문장과 정보만을 근거로 정답과 해설을 작성하세요.

${rules}
${codeGuide}
## 노트 제목
${noteTitle}

## 노트 내용
${noteContent}`;
}
