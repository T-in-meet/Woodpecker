export function normalizeAnswer(answer: string): string {
  return answer
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,;:!?'"()[\]{}]/g, "");
}

export function gradeMultipleChoiceAnswer(
  userAnswer: string,
  correctIndex: number,
): boolean {
  return Number(userAnswer) === correctIndex;
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
