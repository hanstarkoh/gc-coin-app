import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('events')
      .select('id, title, description, reward, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, events: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { title, description, reward } = await req.json();
    const r = Number(reward);
    if (!title?.trim() || !r || r <= 0) {
      return NextResponse.json({ ok: false, error: '이벤트 제목과 보상 코인을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('events').insert({
      title: title.trim(),
      description: (description || '').trim() || null,
      reward: r,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
