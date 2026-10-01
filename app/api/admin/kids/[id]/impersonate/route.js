import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin, setKidSession } from '@/lib/session';

// 관리자가 "테스트 계정으로 체험하기"를 누르면 그 계정의 청소년 세션을 바로 심어줍니다.
// 실제 청소년 계정은 절대 이 경로로 들어갈 수 없게(is_test=true인 계정만) 서버에서 다시 확인함 —
// 관리자가 실수로 다른 청소년 세션을 가로채는 사고를 방지하기 위함.
export async function POST(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: kid, error } = await sb.from('kids').select('id, is_test').eq('id', params.id).single();
    if (error || !kid) return NextResponse.json({ ok: false, error: '청소년을 찾을 수 없어요.' }, { status: 404 });
    if (!kid.is_test) {
      return NextResponse.json({ ok: false, error: '테스트 계정만 체험 로그인할 수 있어요.' }, { status: 400 });
    }
    setKidSession(kid.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
