import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId');
    const date = searchParams.get('date');

    const sb = supabaseAdmin();
    let query = sb
      .from('transactions')
      .select('id, kid_id, kid_name, type, amount, reason, tx_date, created_at, quantity, fulfilled, ready_at, pickup_location')
      .order('created_at', { ascending: false })
      .limit(date ? 500 : 50);
    if (kidId) query = query.eq('kid_id', kidId);
    if (date) query = query.eq('tx_date', date);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, transactions: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
