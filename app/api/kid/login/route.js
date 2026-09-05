import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setKidSession } from '@/lib/session';

export async function POST(req) {
  try {
    const { kidId, pin } = await req.json();
    if (!kidId || !/^\d{4}$/.test(pin || '')) {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: kid, error } = await sb.from('kids').select('id, pin').eq('id', kidId).single();
    if (error || !kid) {
      return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    }

    if (!kid.pin) {
      // 처음 로그인 -> PIN 설정
      const { error: updErr } = await sb.from('kids').update({ pin }).eq('id', kidId);
      if (updErr) throw updErr;
      setKidSession(kidId);
      return NextResponse.json({ ok: true, created: true });
    }

    if (kid.pin !== pin) {
      return NextResponse.json({ ok: false, error: 'PIN이 올바르지 않아요.' }, { status: 401 });
    }

    setKidSession(kidId);
    return NextResponse.json({ ok: true, created: false });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
