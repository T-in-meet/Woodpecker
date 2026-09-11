import { Button } from "@/components/ui/button";

type QuizSubmitButtonProps = {
  disabled: boolean;
  onClick: () => void;
};

export function QuizSubmitButton({ disabled, onClick }: QuizSubmitButtonProps) {
  return (
    // 비활성 상태를 반투명 대신 outline 버튼처럼 보이게 덮어쓴다.
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      size="lg"
      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:border-border disabled:bg-background disabled:text-muted-foreground disabled:opacity-100 disabled:shadow-none"
    >
      정답 확인
    </Button>
  );
}
