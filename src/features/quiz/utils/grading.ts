// 대소문자·공백·문장부호 차이는 같은 답으로 본다.
// (프롬프트에서도 이 변형들은 acceptedAnswers에 넣지 말라고 안내한다.)
//
// 문장부호는 목록으로 열거하지 않고 유니코드 분류(\p{P})로 잡는다.
// 열거하면 TCP/IP의 슬래시처럼 빠뜨린 문자가 그대로 오답 처리로 이어진다.
//
// 다만 뜻을 담는 문자는 남긴다. 지우면 서로 다른 답이 같은 답이 되기 때문이다.
// - \p{P}에 속하지만 남기는 것: # % & @ * (C#, 50%, R&D, A* …)
// - \p{S}는 애초에 지우지 않는다. + 를 지우면 C++와 C가 같아진다.
const MEANINGFUL_MARKS = new Set(["#", "%", "&", "@", "*"]);

// 숫자와 숫자 사이에 오면 값을 가르는 문자. 3.14와 314, 1/2와 12는 다른 답이다.
// 자릿수 쉼표(1,000)는 여기 넣지 않는다. 지워야 1000과 같은 답이 된다.
const DIGIT_SEPARATORS = new Set([".", "/", ":", "-"]);

const PUNCTUATION = /\p{P}/gu;

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function stripPunctuation(text: string): string {
  return text.replace(PUNCTUATION, (mark, at: number, whole: string) => {
    if (MEANINGFUL_MARKS.has(mark)) return mark;

    if (
      DIGIT_SEPARATORS.has(mark) &&
      isDigit(whole[at - 1]) &&
      isDigit(whole[at + 1])
    ) {
      return mark;
    }

    // 부호는 맨 앞에서만 남긴다. COVID-19·RS-232의 하이픈까지 남기면
    // 하이픈을 빼고 입력한 정답이 오답 처리된다.
    if (mark === "-" && at === 0 && isDigit(whole[1])) return mark;

    return "";
  });
}

export function normalizeAnswer(answer: string): string {
  return stripPunctuation(answer.trim().toLowerCase().replace(/\s+/g, ""));
}

export function gradeBlankAnswer(
  userAnswer: string,
  correctAnswer: string,
  acceptedAnswers: string[],
): boolean {
  const normalized = normalizeAnswer(userAnswer);

  if (!normalized) return false;

  const allAccepted = [correctAnswer, ...acceptedAnswers];
  return allAccepted.some(
    (accepted) => normalizeAnswer(accepted) === normalized,
  );
}
