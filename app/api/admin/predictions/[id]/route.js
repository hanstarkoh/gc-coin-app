import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

// 베팅이 걸려 있는 질문도 삭제할 수 있게 합니다. 아직 결과 발표 전(진행 중/마감)인
// 베팅은 삭제 전에 걸었던 만큼 코인을 환불해서 아무도 손해 보지 않게 하고,
// 이미 결과가 발표된 베팅은 정산이 끝난 상태라 그대로 두고(중복 지급 방지) 삭제만 합니다.
export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: pred, error: predErr } = await sb
      .from('predictions')
      .select('id, question, status')
      .eq('id', params.id)
      .single();
    if (predErr || !pred) return NextResponse.json({ ok: false, error: '질문을 찾을 수 없어요.' }, { status: 404 });

    if (pred.status !== 'resolved') {
      const { data: bets, error: betsErr } = await sb
        .from('prediction_bets')
        .select('id, kid_id, kid_name, amount')
        .eq('prediction_id', pred.id);
      if (betsErr) throw betsErr;

      for (const bet of bets) {
        const { data: kid, error: kidErr } = await sb.from('kids').select('balance').eq('id', bet.kid_id).single();
        if (kidErr || !kid) continue;
        const { error: balErr } = await sb
          .from('kids')
          .update({ balance: kid.balance + bet.amount })
          .eq('id', bet.kid_id);
        if (balErr) throw balErr;

        const { error: txErr } = await sb.from('transactions').insert({
          kid_id: bet.kid_id,
          kid_name: bet.kid_name,
          type: 'earn',
          amount: bet.amount,
          reason: `🎲 예측 삭제로 베팅 환불: ${pred.question}`,
          tx_date: new Date().toISOString().slice(0, 10),
        });
        if (txErr) throw txErr;
      }
    }

    const { error } = await sb.from('predictions').delete().eq('id', pred.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
