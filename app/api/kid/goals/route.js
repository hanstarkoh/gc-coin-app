import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { getTopDonors } from '@/lib/goals';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: active, error: activeErr } = await sb
      .from('group_goals')
      .select('id, title, description, target, current, achieved_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (activeErr) throw activeErr;

    const goals = await Promise.all(
      active.map(async (g) => ({ ...g, topDonors: await getTopDonors(sb, g.id, 5) }))
    );

    const { data: history, error: historyErr } = await sb
      .from('group_goals')
      .select('id, title, target, completed_at')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(5);
    if (historyErr) throw historyErr;

    return NextResponse.json({ ok: true, goals, history });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
