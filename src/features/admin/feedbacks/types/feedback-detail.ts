import type {
  FeedbackArea,
  FeedbackCategory,
  FeedbackStatus,
} from "./feedback-list";

/**
 * private Storage object를 브라우저에서 표시하기 위한 signed URL 정보입니다.
 */
export type FeedbackSignedImage = {
  /** DB에 저장된 bucket 내부 object path */
  path: string;

  /** 제한 시간 동안 접근 가능한 서명 URL */
  signedUrl: string;
};

/**
 * 피드백 작성자 표시 정보입니다.
 */
export type AdminFeedbackDetailUser = {
  /** auth.users/profile id */
  id: string;

  /** 화면에 표시할 사용자 이름 */
  name: string;

  /** 사용자 canonical email. 없으면 null */
  email: string | null;

  /** 사용자 avatar URL. 없으면 null */
  avatarUrl: string | null;
};

/**
 * 피드백에 연결된 노트 표시 정보입니다.
 */
export type AdminFeedbackDetailNote = {
  /** notes.id */
  id: string;

  /** notes.title */
  title: string;
};

/**
 * 관리자 답변 상세 표시 모델입니다.
 */
export type AdminFeedbackDetailReply = {
  /** feedback_replies.id */
  id: string;

  /** 답변 제목 */
  title: string;

  /** 답변 본문 */
  content: string;

  /** DB에 저장된 답변 이미지 object path 목록 */
  imagePaths: string[];

  /** 답변 이미지 표시용 signed URL 목록 */
  images: FeedbackSignedImage[];

  /** 답변을 작성한 관리자 auth user id */
  createdBy: string;

  /** 답변 작성자 표시 정보 */
  author: {
    /** auth.users/profile id */
    id: string;

    /** 화면에 표시할 답변 작성자 이름 */
    name: string;

    /** 답변 작성자 avatar URL. 없으면 null */
    avatarUrl: string | null;
  };

  /** 답변 생성 시각 ISO 문자열 */
  createdAt: string;

  /** 답변 수정 시각 ISO 문자열 */
  updatedAt: string;
};

/**
 * 관리자 피드백 상세 화면에서 사용하는 전체 표시 모델입니다.
 */
export type AdminFeedbackDetail = {
  /** feedbacks.id */
  id: string;

  /** 피드백 작성자 정보 */
  user: AdminFeedbackDetailUser;

  /** 연결 노트 정보. 연결이 없으면 null */
  note: AdminFeedbackDetailNote | null;

  /** 피드백 카테고리 */
  category: FeedbackCategory;

  /** 피드백이 가리키는 기능 영역 */
  area: FeedbackArea;

  /** 피드백 처리 상태 */
  status: FeedbackStatus;

  /** 피드백 제목 */
  title: string;

  /** 피드백 본문 */
  content: string;

  /** 사용자 첨부 이미지 signed URL 목록 */
  images: FeedbackSignedImage[];

  /** 피드백 생성 시각 ISO 문자열 */
  createdAt: string;

  /** 피드백 수정 시각 ISO 문자열 */
  updatedAt: string;

  /** 관리자 답변. 아직 없으면 null */
  reply: AdminFeedbackDetailReply | null;
};
