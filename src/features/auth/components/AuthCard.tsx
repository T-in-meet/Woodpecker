import { cn } from "@/lib/utils/cn";

type AuthCardVariant = "compact" | "wide";

type AuthCardProps = {
  children: React.ReactNode;
  variant: AuthCardVariant;
  className?: string;
};

const AUTH_CARD_WIDTHS: Record<AuthCardVariant, string> = {
  compact: "max-w-md",
  wide: "max-w-2xl",
};

/**
 * Auth 페이지에서 사용하는 공통 카드 컨테이너입니다.
 *
 * 카드의 너비와 반응형 외형만 담당하며,
 * 페이지 배치나 폼 내부 레이아웃은 담당하지 않습니다.
 *
 * - compact: 로그인 등 비교적 짧은 Auth 화면
 * - wide: 회원가입 등 비교적 넓은 Auth 화면
 */
export function AuthCard({ children, variant, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "w-full overflow-hidden bg-white px-4 py-8",
        "border-0 shadow-none",
        "auth:rounded-xl auth:border auth:border-outline-variant auth:px-8 auth:shadow-sm",
        AUTH_CARD_WIDTHS[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
