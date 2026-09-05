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

    const { data: pending, error: pendingErr } = await sb
      .from('event_submissions')
      .select('id')
      .eq('event_id', event.id)
      .eq('kid_id', kidId)
      .eq('status', 'pending')
      .limit(1);
    if (pendingErr) throw pendingErr;
    if (pending.length > 0) {
      return NextResponse.json({ ok: false, error: '이미 승인 대기 중이에요.' }, { status: 400 });
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
