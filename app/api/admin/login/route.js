import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setAdminSession } from '@/lib/session';

export async function POST(req) {
  try {
    const { pin } = await req.json();
    if (!/^\d{4}$/.test(pin || '')) {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb.from('settings').select('admin_pin').eq('id', 1).single();
    if (error || !data) throw error || new Error('설정을 찾을 수 없어요.');

    if (data.admin_pin !== pin) {
      return NextResponse.json({ ok: false, error: '비밀번호가 올바르지 않아요.' }, { status: 401 });
    }

    setAdminSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
