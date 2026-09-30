// 경제 퀴즈(사전/사후) 공용 상수·헬퍼. 관리자 등록 화면, 청소년 응시 화면,
// API 라우트가 전부 이 값들을 씀 — 숫자를 바꿀 땐 여기만 바꾸면 됨.

export const QUIZ_TYPES = [
  { key: 'pre', label: '사전' },
  { key: 'post', label: '사후' },
];

export function quizTypeLabel(type) {
  return QUIZ_TYPES.find((t) => t.key === type)?.label ?? type;
}

// 사전 퀴즈는 그 청소년의 등원 기록이 이 횟수 이하일 때까지만 응시 가능("첫 3회 등원 중").
export const PRE_QUIZ_VISIT_LIMIT = 3;

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 5;
export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 10;

// 대충 눌러서 참여 보상만 받는 걸 막기 위한 최소 응시 시간(문항당 초). 정답 여부와 무관하게
// 보상을 주는 설계(사전 퀴즈에서 "잘 보이려고" 미리 답을 찾아보는 걸 막기 위함)라, 대신 이
// 시간으로 최소한 문제를 읽을 시간은 확보함.
export const MIN_SECONDS_PER_QUESTION = 4;

// 5단계 테이블(quiz_sets 등)이 아직 마이그레이션 전이라 없을 때 Supabase가 주는 에러 코드.
// PostgREST는 42P01(Postgres) 대신 스키마 캐시 기준 PGRST205로 응답하는 경우가 많아서 둘 다 확인.
export function isMissingTableError(e) {
  return e?.code === '42P01' || e?.code === 'PGRST205';
}

// 사전 퀴즈 첫 세트가 생기기 "전"부터 있던 청소년은 등원 횟수와 무관하게 1회 허용합니다
// (세트가 없던 시절엔 애초에 "첫 3회 등원 안에" 풀 기회 자체가 없었으니, 그 세트가 생긴
// 시점 기준으로 이미 있던 청소년은 예외로 한 번 구제 — 그 뒤에 새로 등록되는 청소년부터는
// 원래 규칙(첫 PRE_QUIZ_VISIT_LIMIT회 등원 이내)이 정상 적용됩니다).
export function isPreQuizEligible({ kidCreatedAt, quizSetCreatedAt, visitCount }) {
  if (new Date(kidCreatedAt).getTime() < new Date(quizSetCreatedAt).getTime()) return true;
  return visitCount <= PRE_QUIZ_VISIT_LIMIT;
}

export function scoreSubmission(questions, answers) {
  let correctCount = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct_index) correctCount++;
  });
  return { correctCount, totalCount: questions.length };
}
