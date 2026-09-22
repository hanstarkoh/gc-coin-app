import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { eventPosterUrl } from '@/lib/events';

// 오늘(KST 기준) 자정의 UTC 시각 — "오늘 상태"만 보여주기 위한 필터링에 씁니다.
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

    // 오늘 신청/승인/거절된 것만 봐요 — 어제 이미 승인받은 이벤트가 오늘도 계속
    // "완료했어요" 버튼이 막힌 채로 보이면 안 되니까요(이벤트는 매일 다시 도전 가능).
    const { data: submissions, error: subErr } = await sb
      .from('event_submissions')
      .select('event_id, status, created_at')
      .eq('kid_id', kidId)
      .gte('created_at', todayStartUtcIso())
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
