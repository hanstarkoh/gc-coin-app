import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { SECTORS } from '@/lib/stockNews';
import { backfillEarningsIfNeeded } from '@/lib/stocks';

const SECTOR_KEYS = SECTORS.map((s) => s.key);
const FUNDAMENTAL_KEYS = ['growing', 'stagnant', 'crisis'];

// "YYYY-MM-DD" 날짜 입력을 KST 정오 기준 UTC ISO로 변환합니다.
function parseEarningsDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};
    if ('isActive' in body) update.is_active = !!body.isActive;
    if ('sector' in body) update.sector = SECTOR_KEYS.includes(body.sector) ? body.sector : null;
    if ('description' in body) update.description = (body.description || '').trim().slice(0, 60) || null;
    if ('fundamental' in body) update.fundamental = FUNDAMENTAL_KEYS.includes(body.fundamental) ? body.fundamental : null;
    let nextEarningsAtValue = null;
    if ('nextEarningsAt' in body) {
      nextEarningsAtValue = parseEarningsDate(body.nextEarningsAt);
      if (nextEarningsAtValue) update.next_earnings_at = nextEarningsAtValue;
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('stocks').update(update).eq('id', params.id);
    if (error) {
      // fundamental/next_earnings_at 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      const { fundamental, next_earnings_at, ...withoutNew } = update;
      if ('fundamental' in update || 'next_earnings_at' in update) {
        const fallback = await sb.from('stocks').update(withoutNew).eq('id', params.id);
        if (fallback.error) throw fallback.error;
      } else {
        throw error;
      }
    }

    if (nextEarningsAtValue) {
      const { data: stock } = await sb.from('stocks').select('id, name, price, fundamental').eq('id', params.id).single();
      if (stock) await backfillEarningsIfNeeded(sb, stock, nextEarningsAtValue);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('stocks').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
