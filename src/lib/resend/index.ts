import { Resend } from "resend";

// 모듈 로드 시점이 아닌 실제 사용 시점에 인스턴스 생성
// (테스트 환경에서 RESEND_API_KEY 없이 import 시 throw 방지)
let _instance: Resend | undefined;

function getInstance(): Resend {
  if (!_instance) {
    _instance = new Resend(process.env.RESEND_API_KEY!);
  }
  return _instance;
}

export const resend = {
  get emails() {
    return getInstance().emails;
  },
};
