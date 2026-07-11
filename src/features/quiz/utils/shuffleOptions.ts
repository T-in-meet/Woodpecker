import type { MultipleChoiceQuestion, QuizQuestion } from "../schema";

function shuffleMultipleChoiceQuestion(
  question: MultipleChoiceQuestion,
): MultipleChoiceQuestion {
  const paired = question.options.map((option, index) => ({ option, index }));

  for (let i = paired.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = paired[i];
    const b = paired[j];
    if (a && b) {
      paired[i] = b;
      paired[j] = a;
    }
  }

  return {
    ...question,
    options: paired.map((p) => p.option),
    answer: paired.findIndex((p) => p.index === question.answer),
  };
}

export function shuffleMultipleChoiceOptions(
  questions: QuizQuestion[],
): QuizQuestion[] {
  return questions.map((question) =>
    question.type === "multiple_choice"
      ? shuffleMultipleChoiceQuestion(question)
      : question,
  );
}
