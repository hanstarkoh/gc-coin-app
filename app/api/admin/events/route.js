import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { eventPosterUrl } from '@/lib/events';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    let { data, error } = await sb
      .from('events')
      .select('id, title, description, reward, is_active, created_at, poster_path')
      .order('created_at', { ascending: false });
    if (error) {
      // poster_path 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const fallback = await sb
        .from('events')
        .select('id, title, description, reward, is_active, created_at')
        .order('created_at', { ascending: false });
      if (fallback.error) throw fallback.error;
      data = fallback.data.map((e) => ({ ...e, poster_path: null }));
    }
    const events = data.map((e) => ({ ...e, posterUrl: eventPosterUrl(sb, e.poster_path) }));
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { title, description, reward, posterPath } = await req.json();
    const r = Number(reward);
    if (!title?.trim() || !r || r <= 0) {
      return NextResponse.json({ ok: false, error: '이벤트 제목과 보상 코인을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const insertRow = {
      title: title.trim(),
      description: (description || '').trim() || null,
      reward: r,
      ...(posterPath ? { poster_path: posterPath } : {}),
    };
    const { error } = await sb.from('events').insert(insertRow);
    if (error) {
      // poster_path 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const { poster_path, ...withoutPoster } = insertRow;
      const fallback = await sb.from('events').insert(withoutPoster);
      if (fallback.error) throw fallback.error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
