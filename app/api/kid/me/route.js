import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { calcLevel } from '@/lib/level';
import { getEarnedBadges, getNextBadge } from '@/lib/badges';
import { getActiveTitle } from '@/lib/titles';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: kid, error } = await sb.from('kids').select('*').eq('id', kidId).single();
    if (error || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const levelInfo = calcLevel(kid.total_earned);
    const badges = getEarnedBadges(kid);
    const nextBadge = getNextBadge(kid);
    const title = getActiveTitle(kid);

    return NextResponse.json({
      ok: true,
      kid: {
        id: kid.id,
        name: kid.name,
        balance: kid.balance,
        totalEarned: kid.total_earned,
        totalSpent: kid.total_spent,
        attendanceCount: kid.attendance_count,
        purchaseCount: kid.purchase_count,
        investAgreedAt: kid.invest_agreed_at,
        investRealizedProfit: kid.invest_realized_profit || 0,
        investTradeCount: kid.invest_trade_count || 0,
      },
      level: levelInfo,
      badges,
      nextBadge,
      title,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
