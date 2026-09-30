import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { buildReportSentences } from '@/lib/growthMetrics';

export async function GET(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId');
    const scope = searchParams.get('scope') || 'all';

    const sb = supabaseAdmin();
    const sentences = await buildReportSentences(sb, { kidId, scope });
    return NextResponse.json({ ok: true, sentences });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
