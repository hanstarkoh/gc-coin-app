import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { getMonthlyGroupMetrics } from '@/lib/growthMetrics';

export async function GET(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId');
    const scope = searchParams.get('scope') || 'all';
    const from = searchParams.get('from') || `${new Date().getFullYear() - 1}-01-01`;
    const to = searchParams.get('to') || new Date().toISOString().slice(0, 10);

    const sb = supabaseAdmin();
    const result = await getMonthlyGroupMetrics(sb, from, to, { kidId, scope });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
