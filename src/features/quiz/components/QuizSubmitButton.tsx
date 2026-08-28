import { Button } from "@/components/ui/button";

type QuizSubmitButtonProps = {
  disabled: boolean;
  onClick: () => void;
};

export function QuizSubmitButton({ disabled, onClick }: QuizSubmitButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      size="lg"
      className="w-full border-orange-600 bg-orange-400 text-stone-950 hover:bg-orange-500 focus-visible:border-orange-700 focus-visible:ring-orange-500/30 disabled:border-border disabled:bg-background disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none dark:border-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400 dark:disabled:border-border dark:disabled:bg-background dark:disabled:text-muted-foreground"
    >
      정답 확인
    </Button>
  );
}
