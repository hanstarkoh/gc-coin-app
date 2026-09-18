import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { SECTORS } from '@/lib/stockNews';

const SECTOR_KEYS = SECTORS.map((s) => s.key);
const FUNDAMENTAL_KEYS = ['growing', 'stagnant', 'crisis'];

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};
    if ('isActive' in body) update.is_active = !!body.isActive;
    if ('sector' in body) update.sector = SECTOR_KEYS.includes(body.sector) ? body.sector : null;
    if ('description' in body) update.description = (body.description || '').trim().slice(0, 60) || null;
    if ('fundamental' in body) update.fundamental = FUNDAMENTAL_KEYS.includes(body.fundamental) ? body.fundamental : null;

    const sb = supabaseAdmin();
    const { error } = await sb.from('stocks').update(update).eq('id', params.id);
    if (error) {
      // fundamental 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도.
      if ('fundamental' in update) {
        const { fundamental, ...withoutFundamental } = update;
        const fallback = await sb.from('stocks').update(withoutFundamental).eq('id', params.id);
        if (fallback.error) throw fallback.error;
      } else {
        throw error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('stocks').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
