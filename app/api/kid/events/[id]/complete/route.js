import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { isRepeatableEvent } from '@/lib/events';

// 오늘(KST 기준) 자정의 UTC 시각 — 반복형 이벤트의 "오늘 이미 완료했는지" 체크에 씁니다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function todayStartUtcIso() {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - KST_OFFSET_MS).toISOString();
}

export async function POST(_req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    let { data: event, error: eventErr } = await sb
      .from('events')
      .select('id, title, reward, is_active, repeat_type')
      .eq('id', params.id)
      .single();
    if (eventErr) {
      // repeat_type 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const fallback = await sb.from('events').select('id, title, reward, is_active').eq('id', params.id).single();
      if (fallback.error || !fallback.data) {
        return NextResponse.json({ ok: false, error: '진행 중인 이벤트가 아니에요.' }, { status: 400 });
      }
      event = { ...fallback.data, repeat_type: null };
    }
    if (!event || !event.is_active) {
      return NextResponse.json({ ok: false, error: '진행 중인 이벤트가 아니에요.' }, { status: 400 });
    }

    const repeatable = isRepeatableEvent(event.repeat_type);

    // 일회성 이벤트는 한 아이당 평생 한 번만(승인 대기/승인 완료 건이 하나라도 있으면 영구
    // 차단), 반복형 이벤트는 오늘 하루만 막고 다음 날 다시 도전 가능하게 합니다.
    let query = sb
      .from('event_submissions')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('kid_id', kidId)
      .in('status', ['pending', 'approved']);
    if (repeatable) query = query.gte('created_at', todayStartUtcIso());
    const { data: existing, error: existingErr } = await query.limit(1);
    if (existingErr) throw existingErr;
    if (existing.length > 0) {
      const isApproved = existing[0].status === 'approved';
      const approvedMsg = repeatable ? '오늘은 이미 완료해서 코인을 받았어요. 내일 다시 도전해주세요!' : '이미 완료해서 코인을 받은 이벤트예요.';
      return NextResponse.json(
        { ok: false, error: isApproved ? approvedMsg : '이미 승인 대기 중이에요.' },
        { status: 400 }
      );
    }

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const { error: insErr } = await sb.from('event_submissions').insert({
      event_id: event.id,
      kid_id: kid.id,
      kid_name: kid.name,
      event_title: event.title,
      reward: event.reward,
      status: 'pending',
    });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
