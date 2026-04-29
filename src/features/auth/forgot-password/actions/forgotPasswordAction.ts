"use server";

export type ForgotPasswordActionState = {
  status: "idle" | "success" | "field_error" | "global_error";
  fieldErrors: {
    email?: string[];
  } | null;
  message: null;
};

export const INITIAL_FORGOT_PASSWORD_ACTION_STATE: ForgotPasswordActionState = {
  status: "idle",
  fieldErrors: null,
  message: null,
};

export async function forgotPasswordAction(
  _redirectPath: string | null,
  _prevState: ForgotPasswordActionState,
  _formData: FormData,
): Promise<ForgotPasswordActionState> {
  throw new Error("not implemented");
}
