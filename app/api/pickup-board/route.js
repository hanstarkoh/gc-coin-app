import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// 로그인 없이 픽업 현황판 태블릿에서 보는 공개 API입니다.
// 이름/메뉴가 나오지만, 홈 화면 '명예의 전당'도 이름을 공개로 보여주는 것과 같은 수준이라
// 별도 인증 없이 열어둡니다. 완료 처리는 여기서 하지 않고 관리자 화면에서만 합니다.
export async function GET() {
  noStore();
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('transactions')
      .select('id, kid_name, reason, quantity, ready_at, pickup_location')
      .eq('type', 'spend')
      .eq('fulfilled', false)
      .not('ready_at', 'is', null)
      .order('ready_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, orders: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
