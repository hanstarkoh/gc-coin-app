import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { fulfilled } = await req.json();
    const sb = supabaseAdmin();
    const { error } = await sb
      .from('transactions')
      .update({ fulfilled: !!fulfilled })
      .eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
