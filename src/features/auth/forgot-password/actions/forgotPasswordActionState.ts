import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";

export type ForgotPasswordActionState =
  | {
      status: "idle";
      fieldErrors: null;
    }
  | {
      status: "internal_error";
      fieldErrors: null;
      reasonCode: typeof AUTH_LOG_REASONS.INTERNAL_ERROR;
    }
  | {
      status: "invalid_input";
      fieldErrors: {
        email?: string[];
      };
    };

export const INITIAL_FORGOT_PASSWORD_ACTION_STATE: ForgotPasswordActionState = {
  status: "idle",
  fieldErrors: null,
};
