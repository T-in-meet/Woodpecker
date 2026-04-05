import type { FormInput } from "../components/SignupForm";

const FORM_FIELD_NAMES = new Set([
  "email",
  "password",
  "confirmPassword",
  "nickname",
  "termsOfService",
  "privacyPolicy",
  "avatarFile",
]);

export function resolveFieldName(serverField: string): keyof FormInput | null {
  if (FORM_FIELD_NAMES.has(serverField)) {
    return serverField as keyof FormInput;
  }
  const lastSegment = serverField.split(".").at(-1) ?? "";
  if (FORM_FIELD_NAMES.has(lastSegment)) {
    return lastSegment as keyof FormInput;
  }
  return null;
}
