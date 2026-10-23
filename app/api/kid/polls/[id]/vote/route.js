import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { optionIndex } = await req.json();
    const idx = Number(optionIndex);

    const sb = supabaseAdmin();
    const { data: poll, error: pollErr } = await sb
      .from('polls')
      .select('id, question, options, reward, status, closes_at')
      .eq('id', params.id)
      .single();
    if (pollErr || !poll) return NextResponse.json({ ok: false, error: '투표를 찾을 수 없어요.' }, { status: 404 });
    if (!Number.isInteger(idx) || idx < 0 || idx >= poll.options.length) {
      return NextResponse.json({ ok: false, error: '선택지를 골라주세요.' }, { status: 400 });
    }
    const closed = poll.status !== 'open' || (poll.closes_at && new Date(poll.closes_at) <= new Date());
    if (closed) return NextResponse.json({ ok: false, error: '이미 마감된 투표예요.' }, { status: 400 });

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance, total_earned').eq('id', kidId).single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');

    // 투표 기록부터 먼저 넣습니다 — (poll_id, kid_id) 유니크 제약이 있어서, 두 요청이
    // 동시에 들어와도(더블탭 등) 하나만 성공하고 나머지는 여기서 걸러져 보상이 중복 지급되지 않아요.
    const { error: voteErr } = await sb.from('poll_votes').insert({
      poll_id: poll.id,
      kid_id: kidId,
      kid_name: kid.name,
      option_index: idx,
    });
    if (voteErr) {
      if (voteErr.code === '23505') {
        return NextResponse.json({ ok: false, error: '이미 이 투표에 참여했어요.' }, { status: 400 });
      }
      throw voteErr;
    }

    // balance가 읽은 값 그대로일 때만 갱신 — 위 유니크 제약으로 이미 중복 보상은 막히지만,
    // 같은 아이가 거의 동시에 다른 작업(상점 구매 등)으로 잔액을 바꾸는 경우까지 안전하게.
    const { data: updRows, error: updErr } = await sb
      .from('kids')
      .update({ balance: kid.balance + poll.reward, total_earned: (kid.total_earned || 0) + poll.reward })
      .eq('id', kidId)
      .eq('balance', kid.balance)
      .select('id');
    if (updErr) throw updErr;
    if (!updRows || updRows.length === 0) {
      return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
    }

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'earn',
      amount: poll.reward,
      reason: `🗳️ 투표 참여: ${poll.question}`,
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, reward: poll.reward });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
