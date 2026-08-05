/**
 * 이메일 로그인 추가 Server Action 상태입니다.
 */
export type SetPasswordActionState =
  | {
      status: "idle";
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

export const INITIAL_SET_PASSWORD_ACTION_STATE: SetPasswordActionState = {
  status: "idle",
};
