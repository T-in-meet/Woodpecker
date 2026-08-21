export const SIGNUP_FIELD_NAMES = [
  "email",
  "password",
  "confirmPassword",
  "nickname",
  "termsOfService",
  "privacyPolicyAcknowledged",
  "age14OrOlder",
] as const;

export type SignupFieldName = (typeof SIGNUP_FIELD_NAMES)[number];
