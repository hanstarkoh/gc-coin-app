import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { loadKidHistory } from '@/lib/history';

export async function GET(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId');
    const date = searchParams.get('date');

    const sb = supabaseAdmin();

    // 특정 학생의 전체 내역 조회(관리자 대시보드 '전체 현황' 탭)일 때는 주식·상점 구매까지
    // 합쳐서 보여줍니다. 오늘 하루 전체 학생 요약(출석 현황 등 통계용)은 기존처럼
    // transactions만 봅니다 — 코인 지급 통계에 주식/상점 구매가 섞이면 안 되기 때문입니다.
    if (kidId && !date) {
      const data = await loadKidHistory(sb, kidId, 500);
      return NextResponse.json({ ok: true, transactions: data });
    }

    let query = sb
      .from('transactions')
      .select('id, kid_id, kid_name, type, amount, reason, tx_date, created_at, quantity, fulfilled, ready_at, pickup_location')
      .order('created_at', { ascending: false })
      .limit(date ? 500 : 50);
    if (kidId) query = query.eq('kid_id', kidId);
    if (date) query = query.eq('tx_date', date);

    const { data, error } = await query;
    if (error) throw error;

    // kidId 없이(전체 요약용, 예: "오늘 사용 GC") 조회할 때는 테스트 계정 거래를 빼서
    // 테스트 데이터가 실제 통계에 안 섞이게 함. kidId로 특정 학생을 직접 볼 땐 그대로 둠.
    let transactions = data;
    if (!kidId) {
      const { data: testKids, error: testErr } = await sb.from('kids').select('id').eq('is_test', true);
      if (!testErr && testKids?.length) {
        const testIds = new Set(testKids.map((k) => k.id));
        transactions = data.filter((t) => !testIds.has(t.kid_id));
      }
    }
    return NextResponse.json({ ok: true, transactions });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
