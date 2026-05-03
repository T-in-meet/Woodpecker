export type ResetPasswordActionState =
  | {
      status: "idle";
      fieldErrors?: undefined;
    }
  | {
      status: "completed";
      fieldErrors?: undefined;
    }
  | {
      status: "invalid_input";

      fieldErrors: {
        password?: string[];
        confirmPassword?: string[];
      };
    }
  | {
      status: "internal_error";
      fieldErrors?: undefined;
      reason?: "same_password";
    };

export const INITIAL_RESET_PASSWORD_ACTION_STATE: ResetPasswordActionState = {
  status: "idle",
};
