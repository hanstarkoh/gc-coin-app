import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { EVENT_POSTER_BUCKET, EVENT_POSTER_MAX_BYTES, EVENT_POSTER_MIME_TYPES, eventPosterUrl } from '@/lib/events';

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: '이미지 파일을 선택해주세요.' }, { status: 400 });
    }
    if (!EVENT_POSTER_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ ok: false, error: 'png/jpg/webp/gif 이미지만 올릴 수 있어요.' }, { status: 400 });
    }
    if (file.size > EVENT_POSTER_MAX_BYTES) {
      return NextResponse.json({ ok: false, error: '이미지는 5MB 이하만 올릴 수 있어요.' }, { status: 400 });
    }

    const ext = file.type.split('/')[1] || 'png';
    const path = `${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const sb = supabaseAdmin();
    const { error } = await sb.storage.from(EVENT_POSTER_BUCKET).upload(path, buffer, { contentType: file.type });
    if (error) throw error;

    return NextResponse.json({ ok: true, path, url: eventPosterUrl(sb, path) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
