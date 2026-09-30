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

// 5단계 테이블(quiz_sets 등)이 아직 마이그레이션 전이라 없을 때 Supabase가 주는 에러 코드.
// PostgREST는 42P01(Postgres) 대신 스키마 캐시 기준 PGRST205로 응답하는 경우가 많아서 둘 다 확인.
export function isMissingTableError(e) {
  return e?.code === '42P01' || e?.code === 'PGRST205';
}

export function scoreSubmission(questions, answers) {
  let correctCount = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correct_index) correctCount++;
  });
  return { correctCount, totalCount: questions.length };
}
