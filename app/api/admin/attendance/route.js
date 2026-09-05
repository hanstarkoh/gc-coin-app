import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

const ATTENDANCE_COIN = 5;

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { kidIds } = await req.json();
    if (!Array.isArray(kidIds) || kidIds.length === 0) {
      return NextResponse.json({ ok: false, error: '선택된 학생이 없어요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 이미 출석 지급받은 학생 제외
    const { data: already, error: alreadyErr } = await sb
      .from('transactions')
      .select('kid_id')
      .eq('tx_date', today)
      .eq('reason', '출석')
      .in('kid_id', kidIds);
    if (alreadyErr) throw alreadyErr;
    const alreadySet = new Set(already.map((t) => t.kid_id));
    const targetIds = kidIds.filter((id) => !alreadySet.has(id));

    if (targetIds.length === 0) {
      return NextResponse.json({ ok: true, given: 0, message: '이미 모두 오늘 지급받았어요.' });
    }

    const { data: kids, error: kidsErr } = await sb
      .from('kids')
      .select('id, name, balance, total_earned, attendance_count')
      .in('id', targetIds);
    if (kidsErr) throw kidsErr;

    for (const kid of kids) {
      const { error: updErr } = await sb
        .from('kids')
        .update({
          balance: kid.balance + ATTENDANCE_COIN,
          total_earned: kid.total_earned + ATTENDANCE_COIN,
          attendance_count: kid.attendance_count + 1,
        })
        .eq('id', kid.id);
      if (updErr) throw updErr;

      const { error: txErr } = await sb.from('transactions').insert({
        kid_id: kid.id,
        kid_name: kid.name,
        type: 'earn',
        amount: ATTENDANCE_COIN,
        reason: '출석',
        tx_date: today,
      });
      if (txErr) throw txErr;
    }

    return NextResponse.json({ ok: true, given: kids.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
