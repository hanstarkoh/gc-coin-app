import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { QUIZ_TYPES, MIN_CHOICES, MAX_CHOICES, MIN_QUESTIONS, MAX_QUESTIONS, isMissingTableError } from '@/lib/quiz';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const [{ data: sets, error: setsErr }, { data: questions, error: qErr }, { data: submissions, error: subErr }] = await Promise.all([
      sb.from('quiz_sets').select('*').order('created_at', { ascending: false }),
      sb.from('quiz_questions').select('*').order('order_index', { ascending: true }),
      sb.from('quiz_submissions').select('quiz_set_id, correct_count, total_count'),
    ]);
    if (setsErr) throw setsErr;
    if (qErr) throw qErr;
    if (subErr) throw subErr;

    const list = (sets || []).map((s) => {
      const qs = (questions || []).filter((q) => q.quiz_set_id === s.id);
      const subs = (submissions || []).filter((sub) => sub.quiz_set_id === s.id);
      return {
        ...s,
        questions: qs,
        submissionCount: subs.length,
        avgCorrectRate: subs.length > 0 ? Math.round((subs.reduce((sum, sub) => sum + sub.correct_count / sub.total_count, 0) / subs.length) * 1000) / 10 : null,
      };
    });

    return NextResponse.json({ ok: true, sets: list });
  } catch (e) {
    // 마이그레이션 전(테이블이 아직 없음)이면 빈 목록으로 처리해서 탭이 깨지지 않게 함.
    if (isMissingTableError(e)) return NextResponse.json({ ok: true, sets: [] });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < MIN_QUESTIONS || questions.length > MAX_QUESTIONS) {
    return `문항은 ${MIN_QUESTIONS}~${MAX_QUESTIONS}개여야 해요.`;
  }
  for (const q of questions) {
    if (!q.question?.trim()) return '모든 문항에 질문을 입력해주세요.';
    if (!Array.isArray(q.choices) || q.choices.length < MIN_CHOICES || q.choices.length > MAX_CHOICES) {
      return `보기는 ${MIN_CHOICES}~${MAX_CHOICES}개여야 해요.`;
    }
    if (q.choices.some((c) => !c?.trim())) return '보기를 모두 입력해주세요.';
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.choices.length) {
      return '정답을 선택해주세요.';
    }
  }
  return null;
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { type, title, reward, questions, isActive } = await req.json();
    if (!QUIZ_TYPES.some((t) => t.key === type)) return NextResponse.json({ ok: false, error: '잘못된 퀴즈 유형이에요.' }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ ok: false, error: '제목을 입력해주세요.' }, { status: 400 });
    const rewardNum = Number(reward);
    if (!Number.isInteger(rewardNum) || rewardNum < 0) return NextResponse.json({ ok: false, error: '보상은 0 이상 정수여야 해요.' }, { status: 400 });
    const qErr = validateQuestions(questions);
    if (qErr) return NextResponse.json({ ok: false, error: qErr }, { status: 400 });

    const sb = supabaseAdmin();

    if (isActive) {
      const { error: deactErr } = await sb.from('quiz_sets').update({ is_active: false }).eq('type', type).eq('is_active', true);
      if (deactErr) throw deactErr;
    }

    const { data: set, error: setErr } = await sb
      .from('quiz_sets')
      .insert({ type, title: title.trim(), reward: rewardNum, is_active: !!isActive, is_open: true })
      .select('id')
      .single();
    if (setErr) throw setErr;

    const { error: insertErr } = await sb.from('quiz_questions').insert(
      questions.map((q, i) => ({
        quiz_set_id: set.id,
        order_index: i,
        question: q.question.trim(),
        choices: q.choices.map((c) => c.trim()),
        correct_index: q.correctIndex,
      }))
    );
    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true, id: set.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
