import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { getTopDonors } from '@/lib/goals';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: goals, error } = await sb
      .from('group_goals')
      .select('id, title, description, target, current, is_active, achieved_at, completed_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const items = await Promise.all(
      goals.map(async (g) => ({ ...g, topDonors: await getTopDonors(sb, g.id, 5) }))
    );

    return NextResponse.json({ ok: true, goals: items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { title, description, target } = await req.json();
    const t = Number(target);
    if (!title?.trim() || !t || t <= 0) {
      return NextResponse.json({ ok: false, error: '목표 이름과 목표 금액을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('group_goals').insert({
      title: title.trim(),
      description: (description || '').trim() || null,
      target: t,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
