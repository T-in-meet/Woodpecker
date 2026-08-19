/**
 * Note embedding 청킹에 사용하는 기본 최대 token 수입니다.
 *
 * 특정 Provider/Model의 최대 입력 한도에 종속되지 않는 보수적인 공통값이며,
 * 향후 Runtime Model별 정책을 도입할 경우 별도 정책으로 대체할 수 있습니다.
 */
export const DEFAULT_NOTE_CHUNK_TOKEN_LIMIT = 1500;

/**
 * 인접한 Note embedding chunk 사이에 중복으로 포함할 기본 token 수입니다.
 *
 * chunk 경계에서 문맥이 단절되는 것을 완화하기 위해 사용합니다.
 */
export const DEFAULT_NOTE_CHUNK_TOKEN_OVERLAP = 200;
