type SignupFormValues = {
  email: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
  agreements: {
    termsOfService: boolean;
    privacyPolicy: boolean;
  };
  avatarFile?: File | null;
};

type SignupRequestPayload =
  | {
      requestType: "json";
      body: {
        email: string;
        password: string;
        nickname: string;
        agreements: {
          termsOfService: boolean;
          privacyPolicy: boolean;
        };
      };
    }
  | {
      requestType: "multipart";
      body: FormData;
    };

export function buildSignupRequestPayload(
  input: SignupFormValues,
): SignupRequestPayload {
  const { email, password, nickname, agreements, avatarFile } = input;

  if (avatarFile instanceof File) {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);
    formData.append("nickname", nickname);
    formData.append("agreements", JSON.stringify(agreements));
    formData.append("avatarFile", avatarFile);
    return { requestType: "multipart", body: formData };
  }

  return {
    requestType: "json",
    body: { email, password, nickname, agreements },
  };
}
