import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { quizTypeLabel, isPreQuizEligible, isMissingTableError } from '@/lib/quiz';

// 지금 이 청소년이 풀 수 있는(아직 안 푼) 퀴즈 하나를 돌려줍니다(사전 먼저, 그다음 사후).
// 마이그레이션 전(퀴즈 테이블이 아직 없는 상태)이거나 활성 세트가 없으면 quiz:null로 조용히
// 처리해서 청소년 대시보드가 절대 깨지지 않게 합니다.
export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();

    const { data: submissions, error: subErr } = await sb.from('quiz_submissions').select('quiz_type').eq('kid_id', kidId);
    if (subErr) throw subErr;
    const done = new Set((submissions || []).map((s) => s.quiz_type));

    const wantsPre = !done.has('pre');
    const wantsPost = !done.has('post');
    if (!wantsPre && !wantsPost) return NextResponse.json({ ok: true, quiz: null });

    let eligibleType = null;
    let set = null;
    if (wantsPre) {
      const { data: preSet, error: preSetErr } = await sb
        .from('quiz_sets')
        .select('id, type, title, reward, is_open, created_at')
        .eq('type', 'pre')
        .eq('is_active', true)
        .maybeSingle();
      if (preSetErr) throw preSetErr;
      if (preSet) {
        const [{ data: kid, error: kidErr }, { count, error: cntErr }] = await Promise.all([
          sb.from('kids').select('created_at').eq('id', kidId).single(),
          sb.from('transactions').select('id', { count: 'exact', head: true }).eq('kid_id', kidId).eq('reason', '출석'),
        ]);
        if (kidErr) throw kidErr;
        if (cntErr) throw cntErr;
        if (isPreQuizEligible({ kidCreatedAt: kid.created_at, quizSetCreatedAt: preSet.created_at, visitCount: count || 0 })) {
          eligibleType = 'pre';
          set = preSet;
        }
      }
    }
    if (!eligibleType && wantsPost) {
      const { data: postSet, error: postSetErr } = await sb
        .from('quiz_sets')
        .select('id, type, title, reward, is_open, created_at')
        .eq('type', 'post')
        .eq('is_active', true)
        .eq('is_open', true)
        .maybeSingle();
      if (postSetErr) throw postSetErr;
      if (postSet) {
        eligibleType = 'post';
        set = postSet;
      }
    }
    if (!eligibleType || !set) return NextResponse.json({ ok: true, quiz: null });

    const { data: questions, error: qErr } = await sb
      .from('quiz_questions')
      .select('id, question, choices')
      .eq('quiz_set_id', set.id)
      .order('order_index', { ascending: true });
    if (qErr) throw qErr;

    return NextResponse.json({
      ok: true,
      quiz: {
        id: set.id,
        type: set.type,
        typeLabel: quizTypeLabel(set.type),
        title: set.title,
        reward: set.reward,
        questions: questions || [],
      },
    });
  } catch (e) {
    // 새 테이블 마이그레이션 전(테이블이 아직 없음, Postgres 42P01)이면 기능이 아직 없는 걸로
    // 조용히 처리해서 대시보드를 막지 않음. 그 외 진짜 에러는 그대로 500으로 보고함.
    if (isMissingTableError(e)) return NextResponse.json({ ok: true, quiz: null });
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
