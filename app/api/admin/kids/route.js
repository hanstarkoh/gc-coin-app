import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('kids')
      .select('id, name, balance, pin, total_earned, total_spent, attendance_count, purchase_count, gender')
      .order('name', { ascending: true });
    if (error) {
      // gender 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니, 그때는 그 컬럼
      // 없이 한 번 더 시도해서 관리자 대시보드 전체가 막히지 않게 합니다.
      const fallback = await sb
        .from('kids')
        .select('id, name, balance, pin, total_earned, total_spent, attendance_count, purchase_count')
        .order('name', { ascending: true });
      if (fallback.error) throw fallback.error;
      const kids = fallback.data.map((k) => ({ ...k, hasPin: !!k.pin, pin: undefined, gender: null }));
      return NextResponse.json({ ok: true, kids });
    }
    const kids = data.map((k) => ({ ...k, hasPin: !!k.pin, pin: undefined }));
    return NextResponse.json({ ok: true, kids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { name, startBalance, gender } = await req.json();
    const trimmed = (name || '').trim();
    if (!trimmed) return NextResponse.json({ ok: false, error: '이름을 입력해주세요.' }, { status: 400 });
    const genderValue = gender === 'male' || gender === 'female' ? gender : null;

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('kids')
      .insert({ name: trimmed, balance: Number(startBalance) || 0, gender: genderValue })
      .select('id, name, balance, gender')
      .single();
    if (error) {
      // gender 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 그때는 없이 등록합니다.
      const fallback = await sb
        .from('kids')
        .insert({ name: trimmed, balance: Number(startBalance) || 0 })
        .select('id, name, balance')
        .single();
      if (fallback.error) throw fallback.error;
      return NextResponse.json({ ok: true, kid: { ...fallback.data, gender: null } });
    }
    return NextResponse.json({ ok: true, kid: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
