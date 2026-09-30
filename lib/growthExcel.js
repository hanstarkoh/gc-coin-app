// 성장 지표 결과보고서 엑셀(.xlsx) 생성 모듈. 화면(관리자 "성장 지표" 탭)이 보여주는 것과
// 같은 lib/growthMetrics.js 계산 결과를 받아서 시트 6개로 정리합니다. 계산 로직은 절대 이
// 파일에 넣지 않고(그러면 화면·엑셀 결과가 어긋날 수 있음) 오직 서식/배치만 담당합니다.
//
// 좋아짐/나빠짐 색칠은 매 셀마다 "동적 조건부서식 규칙"이 아니라, 서버에서 이미 계산한
// compareDirection() 판정 결과를 그대로 셀 서식(사용자 정의 숫자서식의 아이콘+색, 배경 채우기)에
// 반영하는 방식입니다. 표본이 적은 지표별로 "어느 방향이 좋은 건지"가 다르기 때문에(예: 추격매수는
// 줄어야 좋음) 엑셀 기본 조건부서식(상대적 상/하위 기준)보다 이 방식이 훨씬 정확합니다.
// 금액/비율 추이에는 실제 엑셀 네이티브 데이터 막대(dataBar 조건부서식)를 적용합니다.

import ExcelJS from 'exceljs';
import { compareDirection } from './growthMetrics';

const NAVY = 'FF16324F';
const GOLD = 'FFE8B84B';
const FILL_HEADER = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
const FILL_IMPROVED = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
const FILL_WORSENED = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
const FILL_SAME = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
const FILL_INSUFFICIENT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
const FONT_IMPROVED = { color: { argb: 'FF166534' }, bold: true };
const FONT_WORSENED = { color: { argb: 'FF991B1B' }, bold: true };
const FONT_GRAY = { color: { argb: 'FF6B7280' }, italic: true };
const FONT_HEADER = { color: { argb: 'FFFFFFFF' }, bold: true };
const THIN_GRAY = { style: 'thin', color: { argb: 'FFE5E7EB' } };

const GOAL_LABELS = {
  계획적_금융생활: '계획적 금융생활',
  합리적_의사결정: '합리적 의사결정',
  경제_흐름_이해: '경제 흐름 이해',
  근로_나눔: '근로 · 나눔',
};

const KID_METRIC_LABELS = {
  savingsRate: '저축률',
  depositPrincipal: '예금 평균 원금',
  assetMaintenanceRatio: '등원간 자산유지율',
  chaseBuyRate: '추격매수 비율',
  overvaluedBuyRate: '고평가매수 비율',
  undervaluedBuyRate: '저평가매수 비율',
  memoRate: '매수메모 작성률',
  feeToProfitRatio: '수수료/손익 비율',
  badNewsSellReactRate: '악재직후매도 비율',
  goodNewsBuyReactRate: '호재직후매수 비율',
  jobCompletionRate: '구인시장 완료율',
  donationRate: '기부율',
};

// direction: 'up'이면 값이 커질수록 좋음, 'down'이면 값이 작아질수록 좋음. lib/growthMetrics.js의
// compareDirection() 호출부와 정확히 동일하게 맞춰뒀습니다(둘이 어긋나면 화면·엑셀 판정이 달라짐).
const METRIC_DIRECTION = {
  savingsRate: 'up',
  depositPrincipal: 'up',
  depositUserCount: 'up',
  assetMaintenanceRatio: 'up',
  chaseBuyRate: 'down',
  overvaluedBuyRate: 'down',
  undervaluedBuyRate: 'up',
  memoRate: 'up',
  feeToProfitRatio: 'down',
  badNewsSellReactRate: 'down',
  goodNewsBuyReactRate: 'down',
  jobCompletionRate: 'up',
  donationRate: 'up',
  avgSavingsRate: 'up',
  avgDonationRate: 'up',
};

const MONTHLY_METRIC_ROWS = [
  { goal: '계획적_금융생활', key: 'avgSavingsRate', label: '평균 저축률', kind: 'pct', bucket: 'savings', field: 'avgSavingsRate' },
  { goal: '계획적_금융생활', key: 'depositUserCount', label: '예금 이용 인원', kind: 'count', bucket: 'savings', field: 'depositUserCount' },
  { goal: '합리적_의사결정', key: 'chaseBuyRate', label: '추격매수 비율', kind: 'pct', bucket: 'investing', field: 'chaseBuyRate' },
  { goal: '합리적_의사결정', key: 'overvaluedBuyRate', label: '고평가매수 비율', kind: 'pct', bucket: 'investing', field: 'overvaluedBuyRate' },
  { goal: '합리적_의사결정', key: 'undervaluedBuyRate', label: '저평가매수 비율', kind: 'pct', bucket: 'investing', field: 'undervaluedBuyRate' },
  { goal: '합리적_의사결정', key: 'memoRate', label: '매수메모 작성률', kind: 'pct', bucket: 'investing', field: 'memoRate' },
  { goal: '합리적_의사결정', key: 'feeToProfitRatio', label: '수수료/손익 비율', kind: 'pct', bucket: 'investing', field: 'feeToProfitRatio' },
  { goal: '경제_흐름_이해', key: 'badNewsSellReactRate', label: '악재직후매도 비율', kind: 'pct', bucket: 'investing', field: 'badNewsSellReactRate' },
  { goal: '경제_흐름_이해', key: 'goodNewsBuyReactRate', label: '호재직후매수 비율', kind: 'pct', bucket: 'investing', field: 'goodNewsBuyReactRate' },
  { goal: '근로_나눔', key: 'jobCompletionRate', label: '구인시장 완료율', kind: 'pct', bucket: 'jobs', field: 'completionRate' },
  { goal: '근로_나눔', key: 'avgDonationRate', label: '평균 기부율', kind: 'pct', bucket: 'donation', field: 'avgDonationRate' },
];

/* ---------------------------- 공용 헬퍼 ---------------------------- */

function toLetters(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildAnonMap(kidRows, anonymize) {
  const map = new Map();
  if (!anonymize) {
    kidRows.forEach((k) => map.set(k.kidId, k.kidName));
    return map;
  }
  const sorted = [...kidRows].sort((a, b) => (a.kidName || '').localeCompare(b.kidName || '', 'ko'));
  sorted.forEach((k, i) => map.set(k.kidId, `청소년${toLetters(i)}`));
  return map;
}

function verdictFill(verdict) {
  if (verdict === 'improved') return FILL_IMPROVED;
  if (verdict === 'worsened') return FILL_WORSENED;
  if (verdict === 'same') return FILL_SAME;
  return null;
}
function verdictFont(verdict) {
  if (verdict === 'improved') return FONT_IMPROVED;
  if (verdict === 'worsened') return FONT_WORSENED;
  return FONT_GRAY;
}
function verdictLabel(verdict) {
  if (verdict === 'improved') return '▲ 개선';
  if (verdict === 'worsened') return '▼ 저하';
  if (verdict === 'same') return '− 동일';
  return '? 판단보류';
}

function baseNumFmt(kind) {
  if (kind === 'pct') return '0.0%';
  if (kind === 'gc') return '#,##0" GC"';
  return '#,##0';
}

// 값 자체는 그대로 두고, "이번 달이 지난달보다 올랐는지/내렸는지(아이콘)"와 "그게 좋은
// 신호인지(색)"를 사용자 정의 숫자서식 하나에 함께 담습니다. 예: 0.724 -> 초록 "▲ 72.4%"
function trendNumFmt(kind, rawDelta, verdict) {
  const base = kind === 'pct' ? '0.0%' : kind === 'gc' ? '#,##0" GC"' : '#,##0';
  const color = verdict === 'improved' ? 'Green' : verdict === 'worsened' ? 'Red' : 'Gray';
  const icon = rawDelta > 0 ? '▲ ' : rawDelta < 0 ? '▼ ' : '− ';
  return `[${color}]"${icon}"${base}`;
}

function textWidth(text) {
  let w = 0;
  for (const ch of String(text)) {
    w += /[ㄱ-힝一-鿿]/.test(ch) ? 1.9 : 1;
  }
  return w;
}

function autoWidth(ws, { min = 9, max = 44 } = {}) {
  for (let i = 1; i <= ws.columnCount; i++) {
    const col = ws.getColumn(i);
    let w = min;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const raw = cell.value;
      const text = raw == null ? '' : typeof raw === 'object' ? String(raw.text ?? JSON.stringify(raw)) : String(raw);
      const len = textWidth(text) + 2;
      if (len > w) w = len;
    });
    col.width = Math.min(w, max);
  }
}

function writeSheetHeader(ws, { title, scopeLabel, generatedAt, mergeCols }) {
  ws.mergeCells(1, 1, 1, mergeCols);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 13, color: { argb: NAVY } };

  ws.mergeCells(2, 1, 2, mergeCols);
  const metaCell = ws.getCell(2, 1);
  metaCell.value = `대상: ${scopeLabel}  ·  생성: ${generatedAt}`;
  metaCell.font = { size: 9, color: { argb: 'FF9CA3AF' } };

  return 4; // 다음(=본문 헤더) 행 번호
}

function styleHeaderRow(ws, rowNum) {
  const row = ws.getRow(rowNum);
  row.eachCell({ includeEmpty: false }, (cell) => {
    cell.fill = FILL_HEADER;
    cell.font = FONT_HEADER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { top: THIN_GRAY, bottom: THIN_GRAY, left: THIN_GRAY, right: THIN_GRAY };
  });
}

function addDataBar(ws, ref) {
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'dataBar',
        cfvo: [{ type: 'min' }, { type: 'max' }],
        color: { argb: 'FF9DB8D6' },
      },
    ],
  });
}

/* ---------------------------- ① 요약 ---------------------------- */

function buildSummarySheet(wb, { monthly, scopeLabel, generatedAt }) {
  const ws = wb.addWorksheet('① 요약');
  const months = monthly.months;
  const monthStartCol = 3;
  const lastCol = monthStartCol + months.length - 1;

  const headerRowNum = writeSheetHeader(ws, {
    title: '월별 성장 지표 요약 (목표 · 지표 × 월)',
    scopeLabel,
    generatedAt,
    mergeCols: Math.max(lastCol, 6),
  });

  ws.getCell(headerRowNum, 1).value = '목표';
  ws.getCell(headerRowNum, 2).value = '지표';
  months.forEach((m, i) => {
    ws.getCell(headerRowNum, monthStartCol + i).value = m.month;
  });
  styleHeaderRow(ws, headerRowNum);
  ws.getRow(headerRowNum).height = 22;

  // 표본수 참고 행
  const sampleRowNum = headerRowNum + 1;
  ws.getCell(sampleRowNum, 1).value = '';
  ws.getCell(sampleRowNum, 2).value = '표본수(등원·매수)';
  ws.getCell(sampleRowNum, 2).font = FONT_GRAY;
  months.forEach((m, i) => {
    const c = ws.getCell(sampleRowNum, monthStartCol + i);
    c.value = `등원 ${m.sampleSize.visitorCount} · 매수 ${m.sampleSize.buyCount}`;
    c.font = FONT_GRAY;
    c.alignment = { horizontal: 'center' };
  });

  let rowNum = sampleRowNum + 1;
  let curGoal = null;
  const dataBarRefs = [];

  for (const def of MONTHLY_METRIC_ROWS) {
    if (def.goal !== curGoal) {
      curGoal = def.goal;
      ws.getCell(rowNum, 1).value = GOAL_LABELS[def.goal];
      ws.getCell(rowNum, 1).font = { bold: true, color: { argb: NAVY } };
    }
    ws.getCell(rowNum, 2).value = def.label;

    let prevValue = null;
    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      const bucket = m[def.bucket];
      const insufficient = !bucket || bucket.insufficient;
      const value = insufficient ? null : bucket[def.field];
      const cell = ws.getCell(rowNum, monthStartCol + i);

      if (insufficient || value == null) {
        cell.value = '표본 부족';
        cell.fill = FILL_INSUFFICIENT;
        cell.font = FONT_GRAY;
        cell.alignment = { horizontal: 'center' };
        prevValue = null;
        continue;
      }

      cell.value = value;
      if (prevValue != null) {
        const verdict = compareDirection(prevValue, value, METRIC_DIRECTION[def.key] || 'up');
        cell.numFmt = trendNumFmt(def.kind, value - prevValue, verdict);
        const fill = verdictFill(verdict);
        if (fill) cell.fill = fill;
      } else {
        cell.numFmt = baseNumFmt(def.kind);
      }
      cell.alignment = { horizontal: 'center' };
      prevValue = value;
    }

    dataBarRefs.push(
      `${ws.getColumn(monthStartCol).letter}${rowNum}:${ws.getColumn(lastCol).letter}${rowNum}`
    );
    rowNum++;
  }

  for (const ref of dataBarRefs) addDataBar(ws, ref);

  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: headerRowNum, topLeftCell: `C${sampleRowNum + 1}` }];
  autoWidth(ws);
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 20;
}

/* ---------------------------- ② 보고서 문장 ---------------------------- */

function buildSentencesSheet(wb, { overview, sentences, scopeLabel, generatedAt }) {
  const ws = wb.addWorksheet('② 보고서 문장');
  const headerRowNum = writeSheetHeader(ws, {
    title: '결과보고서용 총평 · 문장 (그대로 복사해서 사용 가능)',
    scopeLabel,
    generatedAt,
    mergeCols: 1,
  });

  let rowNum = headerRowNum;
  if (overview) {
    ws.getCell(rowNum, 1).value = '총평';
    ws.getCell(rowNum, 1).font = { bold: true, color: { argb: NAVY } };
    rowNum++;
    const overviewCell = ws.getCell(rowNum, 1);
    overviewCell.value = overview;
    overviewCell.alignment = { wrapText: true, vertical: 'top' };
    overviewCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F4E8' } };
    ws.getRow(rowNum).height = 60;
    rowNum += 2;
  }

  ws.getCell(rowNum, 1).value = '문장';
  styleHeaderRow(ws, rowNum);
  rowNum++;

  sentences.forEach((s, i) => {
    const cell = ws.getCell(rowNum + i, 1);
    cell.value = `· ${s}`;
    cell.alignment = { wrapText: true, vertical: 'top' };
  });
  ws.getColumn(1).width = 90;
}

/* ---------------------------- ③ 청소년별 ---------------------------- */

function buildKidsSheet(wb, { kidProgress, kidMonthlySeries, anonMap, scopeLabel, generatedAt }) {
  const ws = wb.addWorksheet('③ 청소년별');
  const metricKeys = Object.keys(KID_METRIC_LABELS);
  const fixedCols = 3; // 이름, 성별, 등원횟수
  const perMetricCols = 4; // 처음/최근/변화/판정
  const metricsEndCol = fixedCols + metricKeys.length * perMetricCols;

  const seriesByKid = new Map(kidMonthlySeries.map((s) => [s.kidId, s.series]));
  const refMonths = kidMonthlySeries[0]?.series.map((s) => s.month) || [];
  const refStartCol = metricsEndCol + 1;
  const lastCol = refStartCol + refMonths.length * 2 - 1;

  const headerRowNum = writeSheetHeader(ws, {
    title: '청소년별 성장 지표 (첫 구간 vs 최근 구간)',
    scopeLabel,
    generatedAt,
    mergeCols: lastCol,
  });

  // 2단 헤더: 상단(지표명, 병합) + 하단(처음/최근/변화/판정)
  const subHeaderRowNum = headerRowNum + 1;
  ws.mergeCells(headerRowNum, 1, subHeaderRowNum, 1);
  ws.getCell(headerRowNum, 1).value = '이름';
  ws.mergeCells(headerRowNum, 2, subHeaderRowNum, 2);
  ws.getCell(headerRowNum, 2).value = '성별';
  ws.mergeCells(headerRowNum, 3, subHeaderRowNum, 3);
  ws.getCell(headerRowNum, 3).value = '등원횟수';

  metricKeys.forEach((key, i) => {
    const startCol = fixedCols + i * perMetricCols;
    ws.mergeCells(headerRowNum, startCol + 1, headerRowNum, startCol + perMetricCols);
    ws.getCell(headerRowNum, startCol + 1).value = KID_METRIC_LABELS[key];
    ['처음', '최근', '변화', '판정'].forEach((label, j) => {
      ws.getCell(subHeaderRowNum, startCol + 1 + j).value = label;
    });
  });

  refMonths.forEach((month, i) => {
    const startCol = refStartCol + i * 2;
    ws.mergeCells(headerRowNum, startCol, headerRowNum, startCol + 1);
    ws.getCell(headerRowNum, startCol).value = `${month} (참고)`;
    ws.getCell(subHeaderRowNum, startCol).value = '저축률';
    ws.getCell(subHeaderRowNum, startCol + 1).value = '추격매수';
  });

  styleHeaderRow(ws, headerRowNum);
  styleHeaderRow(ws, subHeaderRowNum);

  let rowNum = subHeaderRowNum + 1;
  const sortedKids = [...kidProgress].sort((a, b) => (a.kidName || '').localeCompare(b.kidName || '', 'ko'));

  for (const kid of sortedKids) {
    ws.getCell(rowNum, 1).value = anonMap.get(kid.kidId) || kid.kidName;
    ws.getCell(rowNum, 2).value = kid.gender === 'male' ? '남' : kid.gender === 'female' ? '여' : '-';
    ws.getCell(rowNum, 3).value = kid.totalVisits;

    metricKeys.forEach((key, i) => {
      const startCol = fixedCols + i * perMetricCols;
      const m = kid.metrics[key];
      const kind = key === 'depositPrincipal' ? 'gc' : 'pct';

      if (!m || m.pending) {
        ws.mergeCells(rowNum, startCol + 1, rowNum, startCol + 4);
        const cell = ws.getCell(rowNum, startCol + 1);
        cell.value = '판단 보류';
        cell.fill = FILL_INSUFFICIENT;
        cell.font = FONT_GRAY;
        cell.alignment = { horizontal: 'center' };
        return;
      }

      const firstCell = ws.getCell(rowNum, startCol + 1);
      const lastCell = ws.getCell(rowNum, startCol + 2);
      const deltaCell = ws.getCell(rowNum, startCol + 3);
      const verdictCell = ws.getCell(rowNum, startCol + 4);

      firstCell.value = m.first;
      firstCell.numFmt = baseNumFmt(kind);
      lastCell.value = m.last;
      lastCell.numFmt = baseNumFmt(kind);

      const delta = m.last - m.first;
      deltaCell.value = delta;
      deltaCell.numFmt = trendNumFmt(kind, delta, m.verdict);

      verdictCell.value = verdictLabel(m.verdict);
      const fill = verdictFill(m.verdict);
      if (fill) verdictCell.fill = fill;
      verdictCell.font = verdictFont(m.verdict);
      verdictCell.alignment = { horizontal: 'center' };
    });

    const series = seriesByKid.get(kid.kidId) || [];
    series.forEach((pt, i) => {
      const startCol = refStartCol + i * 2;
      const c1 = ws.getCell(rowNum, startCol);
      const c2 = ws.getCell(rowNum, startCol + 1);
      if (pt.savingsRate != null) {
        c1.value = pt.savingsRate;
        c1.numFmt = '0.0%';
      } else {
        c1.value = '-';
        c1.font = FONT_GRAY;
      }
      if (pt.chaseBuyRate != null) {
        c2.value = pt.chaseBuyRate;
        c2.numFmt = '0.0%';
      } else {
        c2.value = '-';
        c2.font = FONT_GRAY;
      }
      c1.alignment = { horizontal: 'center' };
      c2.alignment = { horizontal: 'center' };
    });

    rowNum++;
  }

  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: subHeaderRowNum }];
  autoWidth(ws, { max: 16 });
  ws.getColumn(1).width = 14;
}

/* ---------------------------- ④ 누적 도달률 ---------------------------- */

function buildReachSheet(wb, { reach, scopeLabel, generatedAt }) {
  const ws = wb.addWorksheet('④ 누적 도달률');
  const headerRowNum = writeSheetHeader(ws, {
    title: `누적 도달률 (전체 ${reach.totalKids}명 중 한 번이라도 해본 비율)`,
    scopeLabel,
    generatedAt,
    mergeCols: 5,
  });

  ['월', '예금', '투자', '기부', '구인'].forEach((label, i) => {
    ws.getCell(headerRowNum, i + 1).value = label;
  });
  styleHeaderRow(ws, headerRowNum);

  reach.months.forEach((m, i) => {
    const rowNum = headerRowNum + 1 + i;
    ws.getCell(rowNum, 1).value = m.month;
    ws.getCell(rowNum, 1).font = { bold: true };
    ['deposit', 'investing', 'donation', 'job'].forEach((k, j) => {
      const cell = ws.getCell(rowNum, j + 2);
      cell.value = m[k].pct / 100;
      cell.numFmt = '0.0%';
      cell.alignment = { horizontal: 'center' };
    });
  });

  if (reach.months.length > 0) {
    const lastRow = headerRowNum + reach.months.length;
    ['B', 'C', 'D', 'E'].forEach((col) => addDataBar(ws, `${col}${headerRowNum + 1}:${col}${lastRow}`));
  }

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: headerRowNum }];
  autoWidth(ws);
}

/* ---------------------------- ⑤ 퀴즈 (5단계 이전: 자리만 만들어둠) ---------------------------- */

function buildQuizSheet(wb, { scopeLabel, generatedAt }) {
  const ws = wb.addWorksheet('⑤ 퀴즈');
  const headerRowNum = writeSheetHeader(ws, {
    title: '경제 퀴즈 사전 · 사후 결과',
    scopeLabel,
    generatedAt,
    mergeCols: 5,
  });
  ['이름', '사전 점수', '사후 점수', '변화', '문항별 정답률'].forEach((label, i) => {
    ws.getCell(headerRowNum, i + 1).value = label;
  });
  styleHeaderRow(ws, headerRowNum);

  ws.mergeCells(headerRowNum + 2, 1, headerRowNum + 2, 5);
  const note = ws.getCell(headerRowNum + 2, 1);
  note.value = '5단계(앱 안 경제 퀴즈 사전·사후)가 도입되면 이 시트가 자동으로 채워집니다. 현재는 빈 시트예요.';
  note.font = FONT_GRAY;
  note.alignment = { wrapText: true };

  autoWidth(ws);
}

/* ---------------------------- ⑥ 원자료 ---------------------------- */

function buildRawSheet(wb, { visitSnapshots, stockOrders, anonMap, scopeLabel, generatedAt }) {
  const ws = wb.addWorksheet('⑥ 원자료');
  const headerRowNum = writeSheetHeader(ws, {
    title: '계산 근거 원자료 (등원 자산 스냅샷 · 모의투자 주문)',
    scopeLabel,
    generatedAt,
    mergeCols: 7,
  });

  ws.getCell(headerRowNum, 1).value = '[1] 등원 시점 자산 스냅샷 (kid_visit_snapshots)';
  ws.getCell(headerRowNum, 1).font = { bold: true, color: { argb: NAVY } };
  const snapHeaderRow = headerRowNum + 1;
  ['이름', '등원일', '잔액(GC)', '예금원금(GC)', '투자평가금(GC)', '총자산(GC)'].forEach((label, i) => {
    ws.getCell(snapHeaderRow, i + 1).value = label;
  });
  styleHeaderRow(ws, snapHeaderRow);

  let r = snapHeaderRow + 1;
  for (const s of visitSnapshots) {
    ws.getCell(r, 1).value = anonMap.get(s.kid_id) || s.kidName || '-';
    ws.getCell(r, 2).value = s.visit_date;
    ws.getCell(r, 3).value = s.balance;
    ws.getCell(r, 3).numFmt = '#,##0';
    ws.getCell(r, 4).value = s.deposit_principal;
    ws.getCell(r, 4).numFmt = '#,##0';
    ws.getCell(r, 5).value = s.stock_value;
    ws.getCell(r, 5).numFmt = '#,##0';
    ws.getCell(r, 6).value = s.balance + s.deposit_principal + s.stock_value;
    ws.getCell(r, 6).numFmt = '#,##0';
    r++;
  }

  r += 2;
  const orderTitleRow = r;
  ws.getCell(orderTitleRow, 1).value = '[2] 모의투자 매수 · 매도 주문 (stock_orders)';
  ws.getCell(orderTitleRow, 1).font = { bold: true, color: { argb: NAVY } };
  const orderHeaderRow = orderTitleRow + 1;
  ['이름', '구분', '주문시각', '주식수', '가격(GC)', '수수료(GC)', '실현손익(GC)'].forEach((label, i) => {
    ws.getCell(orderHeaderRow, i + 1).value = label;
  });
  styleHeaderRow(ws, orderHeaderRow);

  r = orderHeaderRow + 1;
  for (const o of stockOrders) {
    ws.getCell(r, 1).value = anonMap.get(o.kid_id) || o.kidName || '-';
    ws.getCell(r, 2).value = o.type === 'buy' ? '매수' : '매도';
    ws.getCell(r, 3).value = (o.created_at || '').replace('T', ' ').slice(0, 19);
    ws.getCell(r, 4).value = o.shares;
    ws.getCell(r, 5).value = o.price;
    ws.getCell(r, 5).numFmt = '#,##0';
    ws.getCell(r, 6).value = o.fee ?? 0;
    ws.getCell(r, 6).numFmt = '#,##0';
    if (o.realized != null) {
      ws.getCell(r, 7).value = o.realized;
      ws.getCell(r, 7).numFmt = '#,##0';
    } else {
      ws.getCell(r, 7).value = '-';
      ws.getCell(r, 7).font = FONT_GRAY;
    }
    r++;
  }

  autoWidth(ws);
}

/* ---------------------------- 워크북 조립 ---------------------------- */

export function buildGrowthWorkbook({
  monthly,
  kidProgress,
  goalSummary,
  reach,
  sentences,
  overview,
  kidMonthlySeries,
  visitSnapshots,
  stockOrders,
  scopeLabel,
  anonymize,
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = '금정코인(GC)';
  wb.created = new Date();

  const generatedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const anonMap = buildAnonMap(kidProgress, anonymize);

  buildSummarySheet(wb, { monthly, scopeLabel, generatedAt });
  // buildReportSentences() 결과에는 추세 문장 + 목표별 요약 문장이 이미 함께 들어있어서
  // (lib/growthMetrics.js 참고) 그대로 씁니다 — 여기서 goalSummary로 다시 만들면 중복됩니다.
  buildSentencesSheet(wb, { overview, sentences, scopeLabel, generatedAt });
  buildKidsSheet(wb, { kidProgress, kidMonthlySeries, anonMap, scopeLabel, generatedAt });
  buildReachSheet(wb, { reach, scopeLabel, generatedAt });
  buildQuizSheet(wb, { scopeLabel, generatedAt });
  buildRawSheet(wb, {
    visitSnapshots: visitSnapshots.map((s) => ({ ...s, kidName: anonMap.get(s.kid_id) })),
    stockOrders: stockOrders.map((o) => ({ ...o, kidName: anonMap.get(o.kid_id) })),
    anonMap,
    scopeLabel,
    generatedAt,
  });

  return wb;
}
