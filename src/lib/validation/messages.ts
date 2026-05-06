import { PASSWORD_MIN_LENGTH } from "../constants/user";

export const VALIDATION_MESSAGES = {
  emailRequired: "이메일을 입력해주세요",
  emailInvalid: "올바른 이메일을 입력해주세요",
  passwordMismatch: "비밀번호가 일치하지 않습니다.",
  passwordMinLength: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
} as const;
