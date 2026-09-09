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
    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    if (kid.balance < MEGAPHONE_PRICE) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const { error: updErr } = await sb.from('kids').update({ balance: kid.balance - MEGAPHONE_PRICE }).eq('id', kid.id);
    if (updErr) throw updErr;

    const { error: insErr } = await sb.from('announcements').insert({
      kid_id: kid.id,
      kid_name: kid.name,
      message: trimmed,
      expires_at: kstEndOfTodayUTC().toISOString(),
    });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
