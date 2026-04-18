export const SIGNUP_FIELD_NAMES = [
  "email",
  "password",
  "confirmPassword",
  "nickname",
  "termsOfService",
  "privacyPolicy",
] as const;

export type SignupFieldName = (typeof SIGNUP_FIELD_NAMES)[number];
