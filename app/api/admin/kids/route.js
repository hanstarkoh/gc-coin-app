import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('kids')
      .select('id, name, balance, pin, total_earned, total_spent, attendance_count, purchase_count')
      .order('name', { ascending: true });
    if (error) throw error;
    const kids = data.map((k) => ({ ...k, hasPin: !!k.pin, pin: undefined }));
    return NextResponse.json({ ok: true, kids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { name, startBalance } = await req.json();
    const trimmed = (name || '').trim();
    if (!trimmed) return NextResponse.json({ ok: false, error: '이름을 입력해주세요.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('kids')
      .insert({ name: trimmed, balance: Number(startBalance) || 0 })
      .select('id, name, balance')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, kid: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
