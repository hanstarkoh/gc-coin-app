import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { eventPosterUrl, isRepeatableEvent } from '@/lib/events';

// 오늘(KST 기준) 자정의 UTC 시각 — 반복형 이벤트의 "오늘 상태"만 보여주기 위한 필터링에 씁니다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function todayStartUtcIso() {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - KST_OFFSET_MS).toISOString();
}

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    let { data: events, error: eventsErr } = await sb
      .from('events')
      .select('id, title, description, reward, poster_path, repeat_type')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (eventsErr) {
      // poster_path/repeat_type 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const fallback = await sb
        .from('events')
        .select('id, title, description, reward')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      if (fallback.error) throw fallback.error;
      events = fallback.data.map((e) => ({ ...e, poster_path: null, repeat_type: null }));
    }

    // 일회성 이벤트는 지금까지의 상태 전부(평생 한 번 제한), 반복형 이벤트는 오늘 것만 봅니다.
    const { data: submissions, error: subErr } = await sb
      .from('event_submissions')
      .select('event_id, status, created_at')
      .eq('kid_id', kidId)
      .order('created_at', { ascending: false });
    if (subErr) throw subErr;

    const byEvent = new Map();
    for (const s of submissions) {
      if (!byEvent.has(s.event_id)) byEvent.set(s.event_id, []);
      byEvent.get(s.event_id).push(s);
    }

    const todayIso = todayStartUtcIso();
    const items = events.map((e) => {
      const subs = byEvent.get(e.id) || [];
      const relevant = isRepeatableEvent(e.repeat_type) ? subs.filter((s) => s.created_at >= todayIso) : subs;
      return {
        ...e,
        myStatus: relevant[0]?.status || null,
        posterUrl: eventPosterUrl(sb, e.poster_path),
      };
    });

    return NextResponse.json({ ok: true, events: items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
