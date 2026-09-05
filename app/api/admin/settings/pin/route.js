import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { newPin } = await req.json();
    if (!/^\d{4}$/.test(newPin || '')) {
      return NextResponse.json({ ok: false, error: '4자리 숫자로 입력해주세요.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const { error } = await sb.from('settings').update({ admin_pin: newPin, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
