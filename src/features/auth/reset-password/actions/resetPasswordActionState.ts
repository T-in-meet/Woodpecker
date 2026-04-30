export type ResetPasswordActionState =
  | {
      status: "idle";
    }
  | {
      status: "field_error";
      fieldErrors: {
        password?: string[];
        confirmPassword?: string[];
      };
    }
  | {
      status: "global_error";
      message: string;
    };

export const initialResetPasswordActionState: ResetPasswordActionState = {
  status: "idle",
};
