import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { sanitizePollOptions, POLL_DEFAULT_REWARD, POLL_MAX_REWARD } from '@/lib/polls';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: polls, error } = await sb
      .from('polls')
      .select('id, question, options, reward, status, created_at, closes_at, closed_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: votes, error: votesErr } = await sb
      .from('poll_votes')
      .select('poll_id, kid_name, option_index');
    if (votesErr) throw votesErr;

    const list = polls.map((p) => {
      const myVotes = votes.filter((v) => v.poll_id === p.id);
      const counts = p.options.map((_, i) => myVotes.filter((v) => v.option_index === i).length);
      return { ...p, counts, voteCount: myVotes.length, voters: myVotes };
    });

    return NextResponse.json({ ok: true, polls: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { question, options, reward, closesAt } = await req.json();
    if (!question?.trim()) return NextResponse.json({ ok: false, error: '질문을 입력해주세요.' }, { status: 400 });

    const cleanOptions = sanitizePollOptions(options);
    if (!cleanOptions) {
      return NextResponse.json({ ok: false, error: '선택지를 2개 이상 입력해주세요.' }, { status: 400 });
    }

    const rewardAmount = Number(reward);
    if (!Number.isInteger(rewardAmount) || rewardAmount <= 0 || rewardAmount > POLL_MAX_REWARD) {
      return NextResponse.json({ ok: false, error: `참여 보상을 1~${POLL_MAX_REWARD} GC 사이로 입력해주세요.` }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('polls').insert({
      question: question.trim(),
      options: cleanOptions,
      reward: rewardAmount || POLL_DEFAULT_REWARD,
      closes_at: closesAt || null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
