import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

// 오늘(KST 기준) 자정의 UTC 시각 — "오늘 이미 완료했는지" 체크에 씁니다.
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
    const { data: event, error: eventErr } = await sb
      .from('events')
      .select('id, title, reward, is_active')
      .eq('id', params.id)
      .single();
    if (eventErr || !event || !event.is_active) {
      return NextResponse.json({ ok: false, error: '진행 중인 이벤트가 아니에요.' }, { status: 400 });
    }

    // 오늘 이미 승인 대기 중이거나 승인(코인 지급)된 요청이 있으면 다시 완료 신청을 막습니다.
    // 관리자가 승인 여부를 매번 기억하지 않아도 중복 지급이 안 나게 하려는 안전장치예요.
    const { data: existingToday, error: existingErr } = await sb
      .from('event_submissions')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('kid_id', kidId)
      .gte('created_at', todayStartUtcIso())
      .in('status', ['pending', 'approved'])
      .limit(1);
    if (existingErr) throw existingErr;
    if (existingToday.length > 0) {
      const isApproved = existingToday[0].status === 'approved';
      return NextResponse.json(
        { ok: false, error: isApproved ? '오늘은 이미 완료해서 코인을 받았어요. 내일 다시 도전해주세요!' : '이미 승인 대기 중이에요.' },
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
