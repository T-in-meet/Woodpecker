type AuthEmailTemplateProps = {
  link: string;
};

export function AuthEmailTemplate({ link }: AuthEmailTemplateProps) {
  return <a href={link}>이메일 인증하기</a>;
}
