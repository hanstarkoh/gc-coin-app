import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

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

    // 이 이벤트는 한 아이당 평생 한 번만 완료 신청할 수 있습니다(승인 대기 중이거나 이미
    // 승인된 요청이 하나라도 있으면 막음). 하루 지나면 다시 신청하는 걸 막기 위한 정책이라
    // 날짜로 제한을 풀지 않습니다 — 다시 하게 하고 싶으면 관리자가 새 이벤트를 등록해야 해요.
    const { data: existing, error: existingErr } = await sb
      .from('event_submissions')
      .select('id, status')
      .eq('event_id', event.id)
      .eq('kid_id', kidId)
      .in('status', ['pending', 'approved'])
      .limit(1);
    if (existingErr) throw existingErr;
    if (existing.length > 0) {
      const isApproved = existing[0].status === 'approved';
      return NextResponse.json(
        { ok: false, error: isApproved ? '이미 완료해서 코인을 받은 이벤트예요.' : '이미 승인 대기 중이에요.' },
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
