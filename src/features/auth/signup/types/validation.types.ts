import { VALIDATION_REASON } from "../constants/validation";

export type ValidationReason =
  (typeof VALIDATION_REASON)[keyof typeof VALIDATION_REASON];
