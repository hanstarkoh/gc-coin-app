import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { MEGAPHONE_PRICE, MESSAGE_MAX_LENGTH, kstEndOfTodayUTC } from '@/lib/announcements';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { message } = await req.json();
    const trimmed = (message || '').trim();
    if (!trimmed) return NextResponse.json({ ok: false, error: '메시지를 입력해주세요.' }, { status: 400 });
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      return NextResponse.json({ ok: false, error: `${MESSAGE_MAX_LENGTH}자 이내로 적어주세요.` }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_spent')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    if (kid.balance < MEGAPHONE_PRICE) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    // balance가 읽은 값 그대로일 때만 갱신해서, 두 요청이 거의 동시에 들어와도(더블탭 등)
    // 하나만 성공하게 함 — 안 그러면 코인은 두 번 깎이는데 확성기는 한 번만 올라가요.
    const { data: updRows, error: updErr } = await sb
      .from('kids')
      .update({ balance: kid.balance - MEGAPHONE_PRICE, total_spent: (kid.total_spent || 0) + MEGAPHONE_PRICE })
      .eq('id', kid.id)
      .eq('balance', kid.balance)
      .select('id');
    if (updErr) throw updErr;
    if (!updRows || updRows.length === 0) {
      return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
    }

    // 거래 내역(transactions)에도 남겨야 관리자 화면에서 "쓴 돈"으로 보임.
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kid.id,
      kid_name: kid.name,
      type: 'spend',
      amount: MEGAPHONE_PRICE,
      reason: '📢 확성기',
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    const announcementRow = {
      kid_id: kid.id,
      kid_name: kid.name,
      message: trimmed,
      expires_at: kstEndOfTodayUTC().toISOString(),
      amount: MEGAPHONE_PRICE,
    };
    const { error: insErr } = await sb.from('announcements').insert(announcementRow);
    if (insErr) {
      // amount 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const { amount, ...withoutAmount } = announcementRow;
      const fallback = await sb.from('announcements').insert(withoutAmount);
      if (fallback.error) throw fallback.error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
