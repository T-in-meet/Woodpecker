// 대소문자·공백·문장부호 차이는 같은 답으로 본다.
// (프롬프트에서도 이 변형들은 acceptedAnswers에 넣지 말라고 안내한다.)
//
// 문장부호는 목록으로 열거하지 않고 유니코드 분류(\p{P})로 잡는다.
// 열거하면 TCP/IP의 슬래시처럼 빠뜨린 문자가 그대로 오답 처리로 이어진다.
// 기호(\p{S})는 남긴다. +를 지우면 C++와 C가 같은 답이 된다.
export function normalizeAnswer(answer: string): string {
  return answer.trim().toLowerCase().replace(/\s+/g, "").replace(/\p{P}/gu, "");
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
