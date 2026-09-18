import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { SECTORS } from '@/lib/stockNews';

const SECTOR_KEYS = SECTORS.map((s) => s.key);

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};
    if ('isActive' in body) update.is_active = !!body.isActive;
    if ('sector' in body) update.sector = SECTOR_KEYS.includes(body.sector) ? body.sector : null;
    if ('description' in body) update.description = (body.description || '').trim().slice(0, 60) || null;

    const sb = supabaseAdmin();
    const { error } = await sb.from('stocks').update(update).eq('id', params.id);
    if (error) throw error;
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
