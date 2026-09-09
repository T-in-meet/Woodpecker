"use client";

import { Eye, EyeClosed } from "lucide-react";
import { forwardRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

/**
 * Auth 화면에서 사용하는 비밀번호 입력 필드입니다.
 *
 * 기본적으로 비밀번호를 숨겨 표시하며, 우측 버튼으로
 * 입력값의 표시 여부를 전환할 수 있습니다.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />

        {/* 입력창 내부 토글은 공통 Button의 크기·active 효과를 적용하지 않기 위해 native button을 사용한다. */}
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
          aria-pressed={isVisible}
        >
          {isVisible ? (
            <EyeClosed className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
