// 대소문자·공백·문장부호·하이픈 차이는 같은 답으로 본다.
// (프롬프트에서도 이 변형들은 acceptedAnswers에 넣지 말라고 안내한다.)
export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,;:!?'"()[\]{}\-_·]/g, "");
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
