import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import {
  getMonthlyGroupMetrics,
  getKidProgress,
  getGoalSummary,
  getCumulativeReach,
  buildReportSentences,
  getKidsMonthlySeries,
  getRawExportData,
} from '@/lib/growthMetrics';
import { buildGrowthWorkbook } from '@/lib/growthExcel';

function scopeLabelOf(scope, kidId, kidProgress, anonymize) {
  if (kidId) {
    const kid = kidProgress.find((k) => k.kidId === kidId);
    if (!kid) return '개인';
    return anonymize ? '개인(익명화됨)' : `${kid.kidName} (개인)`;
  }
  if (scope === 'male') return '남자';
  if (scope === 'female') return '여자';
  return '전체';
}

export async function GET(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId') || null;
    const scope = searchParams.get('scope') || 'all';
    const now = new Date();
    const from = searchParams.get('from') || `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = searchParams.get('to') || now.toISOString().slice(0, 10);
    const anonymize = searchParams.get('anonymize') !== '0'; // 기본값 체크(=true)

    const sb = supabaseAdmin();
    const filter = { kidId, scope };

    const [monthly, kidProgress, goalSummary, reach, sentences, kidMonthlySeries, rawExport] = await Promise.all([
      getMonthlyGroupMetrics(sb, from, to, filter),
      getKidProgress(sb, filter),
      getGoalSummary(sb, filter),
      getCumulativeReach(sb, filter),
      buildReportSentences(sb, filter),
      getKidsMonthlySeries(sb, from, to, filter),
      getRawExportData(sb, filter),
    ]);

    const scopeLabel = scopeLabelOf(scope, kidId, kidProgress, anonymize);

    const wb = buildGrowthWorkbook({
      monthly,
      kidProgress,
      goalSummary,
      reach,
      sentences,
      kidMonthlySeries,
      visitSnapshots: rawExport.visitSnapshots,
      stockOrders: rawExport.stockOrders,
      scopeLabel,
      anonymize,
    });

    const buffer = await wb.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `성장지표_${scopeLabel.replace(/[^\w가-힣]/g, '')}_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="growth-metrics.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
