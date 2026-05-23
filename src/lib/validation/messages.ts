import { OTP_LENGTH } from "@/features/auth/constants/otp";

import { PASSWORD_MIN_LENGTH } from "../constants/user";

export const VALIDATION_MESSAGES = {
  emailRequired: "이메일을 입력해주세요",
  emailInvalid: "올바른 이메일을 입력해주세요",
  passwordMismatch: "비밀번호가 일치하지 않습니다.",
  passwordMinLength: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
  otpInvalid: "인증 번호가 올바르지 않습니다.",
  otpLength: `숫자 ${OTP_LENGTH}자리를 입력해주세요.`,
} as const;
