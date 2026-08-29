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
      className="w-full border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 focus-visible:border-neutral-700 focus-visible:ring-neutral-500/30 disabled:border-border disabled:bg-background disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none dark:border-neutral-900 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:disabled:border-border dark:disabled:bg-background dark:disabled:text-muted-foreground"
    >
      정답 확인
    </Button>
  );
}
