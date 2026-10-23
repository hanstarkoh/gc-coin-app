import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

// 투표 보상은 투표하는 순간 바로 지급돼서(예측 시장의 "나중에 정산" 방식과 달리 쌓아두는
// 판돈이 없음), 삭제해도 환불/회수할 게 없습니다 — 그냥 질문과 투표 기록만 지웁니다.
export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('polls').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
