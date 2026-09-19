import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { deleteEventPoster } from '@/lib/events';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};
    if ('isActive' in body) update.is_active = !!body.isActive;

    const sb = supabaseAdmin();

    if ('posterPath' in body) {
      // 새 포스터로 바꾸거나(값이 있으면) 아예 지우는 경우(null) 모두, 기존에 붙어있던
      // 포스터가 있으면 스토리지에서 먼저 지워서 용량이 안 쌓이게 합니다.
      const { data: current } = await sb.from('events').select('poster_path').eq('id', params.id).single();
      if (current?.poster_path && current.poster_path !== body.posterPath) {
        await deleteEventPoster(sb, current.poster_path);
      }
      update.poster_path = body.posterPath || null;
    }

    const { error } = await sb.from('events').update(update).eq('id', params.id);
    if (error) {
      // poster_path 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      if ('poster_path' in update) {
        const { poster_path, ...withoutPoster } = update;
        const fallback = await sb.from('events').update(withoutPoster).eq('id', params.id);
        if (fallback.error) throw fallback.error;
      } else {
        throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: event } = await sb.from('events').select('poster_path').eq('id', params.id).single();
    const { error } = await sb.from('events').delete().eq('id', params.id);
    if (error) throw error;
    if (event?.poster_path) await deleteEventPoster(sb, event.poster_path);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
