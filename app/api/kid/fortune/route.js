import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { FORTUNE_PRICE, drawFortune } from '@/lib/fortunes';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data: already, error } = await sb
      .from('transactions')
      .select('id')
      .eq('kid_id', kidId)
      .eq('tx_date', today)
      .like('reason', '🔮%')
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, drawnToday: (already || []).length > 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: already, error: alreadyErr } = await sb
      .from('transactions')
      .select('id')
      .eq('kid_id', kidId)
      .eq('tx_date', today)
      .like('reason', '🔮%')
      .limit(1);
    if (alreadyErr) throw alreadyErr;
    if ((already || []).length > 0) {
      return NextResponse.json({ ok: false, error: '오늘은 이미 운세를 뽑았어요. 내일 다시 와주세요!' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance, total_spent').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    if (kid.balance < FORTUNE_PRICE) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    // 관리자가 등급별 확률을 조절해뒀을 수 있으니 불러와서 사용(없거나 컬럼이 아직
    // 없으면(마이그레이션 전) 기본값으로 자동 처리됨 — drawFortune이 null도 안전하게 받음).
    const { data: settings } = await sb.from('settings').select('fortune_weights').eq('id', 1).maybeSingle();
    const result = drawFortune(settings?.fortune_weights);

    const newBalance = kid.balance - FORTUNE_PRICE;
    const { error: updErr } = await sb
      .from('kids')
      .update({ balance: newBalance, total_spent: kid.total_spent + FORTUNE_PRICE })
      .eq('id', kidId);
    if (updErr) throw updErr;

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: FORTUNE_PRICE,
      reason: `🔮 오늘의 운세(${result.label})`,
      tx_date: today,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, newBalance, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
