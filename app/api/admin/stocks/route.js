import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { SECTORS } from '@/lib/stockNews';
import { backfillEarningsIfNeeded } from '@/lib/stocks';

// "YYYY-MM-DD" 날짜 입력을 KST 정오 기준 UTC ISO로 변환합니다.
function parseEarningsDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const SECTOR_KEYS = SECTORS.map((s) => s.key);

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stocks')
      .select('id, name, emoji, price, is_active, created_at, sector, description, fundamental, next_earnings_at')
      .order('created_at', { ascending: true });
    if (error) {
      // sector/description/fundamental/next_earnings_at 컬럼이 아직 없는(마이그레이션 전)
      // 상태일 수 있으니, 그때는 그 컬럼 없이 한 번 더 시도해서 종목 관리 탭 전체가 막히지
      // 않게 합니다.
      const mid = await sb
        .from('stocks')
        .select('id, name, emoji, price, is_active, created_at, sector, description')
        .order('created_at', { ascending: true });
      if (!mid.error) {
        const stocks = mid.data.map((s) => ({ ...s, fundamental: null, next_earnings_at: null }));
        return NextResponse.json({ ok: true, stocks });
      }
      const fallback = await sb
        .from('stocks')
        .select('id, name, emoji, price, is_active, created_at')
        .order('created_at', { ascending: true });
      if (fallback.error) throw fallback.error;
      const stocks = fallback.data.map((s) => ({ ...s, sector: null, description: null, fundamental: null, next_earnings_at: null }));
      return NextResponse.json({ ok: true, stocks });
    }
    return NextResponse.json({ ok: true, stocks: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { name, emoji, price, sector, description, nextEarningsAt } = await req.json();
    const p = Number(price);
    if (!name?.trim() || !p || p <= 0) {
      return NextResponse.json({ ok: false, error: '종목 이름과 시작 가격을 확인해주세요.' }, { status: 400 });
    }
    const sectorValue = SECTOR_KEYS.includes(sector) ? sector : null;
    const descriptionValue = (description || '').trim().slice(0, 60) || null;
    const nextEarningsAtValue = parseEarningsDate(nextEarningsAt);

    const sb = supabaseAdmin();
    const insertRow = {
      name: name.trim(),
      emoji: (emoji || '').trim() || '📈',
      price: p,
      sector: sectorValue,
      description: descriptionValue,
      ...(nextEarningsAtValue ? { next_earnings_at: nextEarningsAtValue } : {}),
    };
    let { data: stock, error } = await sb.from('stocks').insert(insertRow).select('id, name, price, fundamental').single();
    if (error) {
      // sector/description/next_earnings_at 컬럼이 아직 없는(마이그레이션 전) 상태일 수
      // 있으니 그때는 없이 등록합니다.
      const fallback = await sb
        .from('stocks')
        .insert({ name: insertRow.name, emoji: insertRow.emoji, price: insertRow.price })
        .select('id, name, price')
        .single();
      if (fallback.error) throw fallback.error;
      stock = fallback.data;
    }

    const { error: histErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: p });
    if (histErr) throw histErr;

    if (nextEarningsAtValue) {
      await backfillEarningsIfNeeded(sb, stock, nextEarningsAtValue);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
