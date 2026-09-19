import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { eventPosterUrl } from '@/lib/events';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    let { data: events, error: eventsErr } = await sb
      .from('events')
      .select('id, title, description, reward, poster_path')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (eventsErr) {
      // poster_path 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const fallback = await sb
        .from('events')
        .select('id, title, description, reward')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (fallback.error) throw fallback.error;
      events = fallback.data.map((e) => ({ ...e, poster_path: null }));
    }

    const { data: submissions, error: subErr } = await sb
      .from('event_submissions')
      .select('event_id, status, created_at')
      .eq('kid_id', kidId)
      .order('created_at', { ascending: false });
    if (subErr) throw subErr;

    const latestByEvent = new Map();
    for (const s of submissions) {
      if (!latestByEvent.has(s.event_id)) latestByEvent.set(s.event_id, s.status);
    }

    const items = events.map((e) => ({
      ...e,
      myStatus: latestByEvent.get(e.id) || null,
      posterUrl: eventPosterUrl(sb, e.poster_path),
    }));

    return NextResponse.json({ ok: true, events: items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
