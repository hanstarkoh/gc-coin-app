import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
// 관리자 목록에 보여줄 개수(데이터를 지우는 건 아니고 조회만 이만큼만 — 실제 보관은
// 종목별 STOCK_EARNINGS_KEEP개까지, lib/stocks.js 참고).
const ADMIN_LIST_LIMIT = 10;

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stock_earnings')
      .select('id, stock_id, stock_name, headline, pct, old_price, new_price, created_at')
      .order('created_at', { ascending: false })
      .limit(ADMIN_LIST_LIMIT);
    if (error) {
      // stock_earnings 테이블이 아직 없는(마이그레이션 전) 상태일 수 있으니 빈 목록으로 처리.
      return NextResponse.json({ ok: true, earnings: [] });
    }
    return NextResponse.json({ ok: true, earnings: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
