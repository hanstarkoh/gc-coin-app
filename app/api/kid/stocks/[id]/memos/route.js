import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

const MEMO_LIST_LIMIT = 10;

export async function GET(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stock_orders')
      .select('id, price, memo, created_at')
      .eq('stock_id', params.id)
      .eq('kid_id', kidId)
      .eq('type', 'buy')
      .not('memo', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MEMO_LIST_LIMIT);
    if (error) {
      // memo 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 빈 목록으로 처리.
      return NextResponse.json({ ok: true, memos: [] });
    }
    return NextResponse.json({ ok: true, memos: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
