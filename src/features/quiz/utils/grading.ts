// 대소문자·공백·문장부호 차이는 같은 답으로 본다.
// (프롬프트에서도 이 변형들은 acceptedAnswers에 넣지 말라고 안내한다.)
//
// 문장부호는 목록으로 열거하지 않고 유니코드 분류(\p{P})로 잡는다.
// 열거하면 TCP/IP의 슬래시처럼 빠뜨린 문자가 그대로 오답 처리로 이어진다.
//
// 다만 뜻을 담는 문자는 남긴다. 지우면 서로 다른 답이 같은 답이 되기 때문이다.
// - \p{P}에 속하지만 남기는 것: # % & @ * (C#, 50%, R&D, A* …)
// - \p{S}는 애초에 지우지 않는다. + 를 지우면 C++와 C가 같아진다.
const IGNORABLE_PUNCTUATION = /(?![#%&@*])\p{P}/gu;

export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(IGNORABLE_PUNCTUATION, "");
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
