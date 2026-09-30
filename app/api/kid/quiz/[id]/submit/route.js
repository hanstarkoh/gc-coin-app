import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { scoreSubmission, isPreQuizEligible, quizTypeLabel } from '@/lib/quiz';

export async function POST(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { answers } = await req.json();
    if (!Array.isArray(answers)) return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });

    const sb = supabaseAdmin();

    const { data: set, error: setErr } = await sb
      .from('quiz_sets')
      .select('id, type, title, reward, is_active, is_open, created_at')
      .eq('id', params.id)
      .single();
    if (setErr || !set) return NextResponse.json({ ok: false, error: '퀴즈를 찾을 수 없어요.' }, { status: 404 });
    if (!set.is_active || (set.type === 'post' && !set.is_open)) {
      return NextResponse.json({ ok: false, error: '지금은 응시할 수 없는 퀴즈예요.' }, { status: 400 });
    }

    const { data: already, error: alreadyErr } = await sb
      .from('quiz_submissions')
      .select('id')
      .eq('kid_id', kidId)
      .eq('quiz_type', set.type)
      .maybeSingle();
    if (alreadyErr) throw alreadyErr;
    if (already) return NextResponse.json({ ok: false, error: '이미 응시했어요.' }, { status: 400 });

    if (set.type === 'pre') {
      const [{ data: kidRow, error: kidRowErr }, { count, error: cntErr }] = await Promise.all([
        sb.from('kids').select('created_at').eq('id', kidId).single(),
        sb.from('transactions').select('id', { count: 'exact', head: true }).eq('kid_id', kidId).eq('reason', '출석'),
      ]);
      if (kidRowErr) throw kidRowErr;
      if (cntErr) throw cntErr;
      if (!isPreQuizEligible({ kidCreatedAt: kidRow.created_at, quizSetCreatedAt: set.created_at, visitCount: count || 0 })) {
        return NextResponse.json({ ok: false, error: '사전 퀴즈 응시 기간(첫 3회 등원)이 지났어요.' }, { status: 400 });
      }
    }

    const { data: questions, error: qErr } = await sb
      .from('quiz_questions')
      .select('id, choices, correct_index')
      .eq('quiz_set_id', set.id)
      .order('order_index', { ascending: true });
    if (qErr) throw qErr;
    if (!questions || questions.length === 0) return NextResponse.json({ ok: false, error: '문항이 없어요.' }, { status: 400 });

    if (answers.length !== questions.length || answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].choices.length)) {
      return NextResponse.json({ ok: false, error: '모든 문항에 답해주세요.' }, { status: 400 });
    }

    const { correctCount, totalCount } = scoreSubmission(questions, answers);

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance, total_earned').eq('id', kidId).single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');

    const { error: insertErr } = await sb.from('quiz_submissions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      quiz_set_id: set.id,
      quiz_type: set.type,
      answers,
      correct_count: correctCount,
      total_count: totalCount,
      reward: set.reward,
    });
    if (insertErr) {
      if (insertErr.code === '23505') return NextResponse.json({ ok: false, error: '이미 응시했어요.' }, { status: 400 });
      throw insertErr;
    }

    if (set.reward > 0) {
      const { error: balErr } = await sb
        .from('kids')
        .update({ balance: kid.balance + set.reward, total_earned: kid.total_earned + set.reward })
        .eq('id', kid.id);
      if (balErr) throw balErr;

      const today = new Date().toISOString().slice(0, 10);
      const { error: txErr } = await sb.from('transactions').insert({
        kid_id: kid.id,
        kid_name: kid.name,
        type: 'quiz',
        amount: set.reward,
        reason: `${quizTypeLabel(set.type)} 경제 퀴즈 참여`,
        tx_date: today,
      });
      if (txErr) throw txErr;
    }

    return NextResponse.json({ ok: true, reward: set.reward, correctCount, totalCount });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
