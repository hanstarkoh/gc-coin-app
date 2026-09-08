import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getActiveTitle } from '@/lib/titles';

export const dynamic = 'force-dynamic';

export async function GET() {
  noStore();
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('kids')
      .select('id, name, pin, invest_realized_profit')
      .order('name', { ascending: true });

    if (error) {
      // invest_realized_profit 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니
      // 이름 목록만이라도 정상 표시되도록 기본 컬럼으로 한 번 더 시도합니다.
      const fallback = await sb.from('kids').select('id, name, pin').order('name', { ascending: true });
      if (fallback.error) throw fallback.error;
      const kids = fallback.data.map((k) => ({ id: k.id, name: k.name, hasPin: !!k.pin, title: null }));
      return NextResponse.json({ ok: true, kids });
    }

    const kids = data.map((k) => ({ id: k.id, name: k.name, hasPin: !!k.pin, title: getActiveTitle(k) }));
    return NextResponse.json({ ok: true, kids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
