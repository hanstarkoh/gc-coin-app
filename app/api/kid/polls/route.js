import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();

    // 마감 시각이 지난 열린 투표는 조회 시점에 자동으로 마감 처리합니다(주식 시세 갱신과 같은 방식).
    const nowIso = new Date().toISOString();
    const { error: autoCloseErr } = await sb
      .from('polls')
      .update({ status: 'closed', closed_at: nowIso })
      .eq('status', 'open')
      .not('closes_at', 'is', null)
      .lte('closes_at', nowIso);
    if (autoCloseErr) throw autoCloseErr;

    const { data: polls, error } = await sb
      .from('polls')
      .select('id, question, options, reward, status, created_at, closes_at, closed_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    const { data: votes, error: votesErr } = await sb
      .from('poll_votes')
      .select('poll_id, kid_id, option_index');
    if (votesErr) throw votesErr;

    const list = polls.map((p) => {
      const relevant = votes.filter((v) => v.poll_id === p.id);
      const mine = relevant.find((v) => v.kid_id === kidId) || null;
      return {
        ...p,
        counts: p.options.map((_, i) => relevant.filter((v) => v.option_index === i).length),
        voteCount: relevant.length,
        myVote: mine ? mine.option_index : null,
      };
    });

    return NextResponse.json({ ok: true, polls: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
