import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { FORTUNE_TIERS } from '@/lib/fortunes';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from('settings').select('fortune_weights').eq('id', 1).single();
    // 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니, 그때는 기본값으로 응답.
    const saved = error ? null : data?.fortune_weights;
    const weights = Object.fromEntries(FORTUNE_TIERS.map((t) => [t.key, saved?.[t.key] ?? t.weight]));
    return NextResponse.json({ ok: true, weights });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { weights } = await req.json();
    if (!weights || typeof weights !== 'object') {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }
    const cleaned = {};
    for (const t of FORTUNE_TIERS) {
      const v = Number(weights[t.key]);
      if (!Number.isFinite(v) || v < 0) {
        return NextResponse.json({ ok: false, error: `${t.label} 확률 값을 확인해주세요.` }, { status: 400 });
      }
      cleaned[t.key] = v;
    }
    const sb = supabaseAdmin();
    const { error } = await sb.from('settings').update({ fortune_weights: cleaned, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
