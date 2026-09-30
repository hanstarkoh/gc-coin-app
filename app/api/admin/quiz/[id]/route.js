import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { title, reward, isActive, isOpen } = await req.json();
    const sb = supabaseAdmin();

    const { data: set, error: setErr } = await sb.from('quiz_sets').select('id, type').eq('id', params.id).single();
    if (setErr || !set) return NextResponse.json({ ok: false, error: '퀴즈를 찾을 수 없어요.' }, { status: 404 });

    const patch = {};
    if (title != null) {
      if (!title.trim()) return NextResponse.json({ ok: false, error: '제목을 입력해주세요.' }, { status: 400 });
      patch.title = title.trim();
    }
    if (reward != null) {
      const rewardNum = Number(reward);
      if (!Number.isInteger(rewardNum) || rewardNum < 0) return NextResponse.json({ ok: false, error: '보상은 0 이상 정수여야 해요.' }, { status: 400 });
      patch.reward = rewardNum;
    }
    if (isOpen != null) patch.is_open = !!isOpen;

    if (isActive === true) {
      // 같은 유형(사전/사후)에서는 한 번에 하나만 활성화되게(청소년에게 보여줄 세트가 헷갈리지 않도록).
      const { error: deactErr } = await sb.from('quiz_sets').update({ is_active: false }).eq('type', set.type).eq('is_active', true);
      if (deactErr) throw deactErr;
      patch.is_active = true;
    } else if (isActive === false) {
      patch.is_active = false;
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: '바꿀 내용이 없어요.' }, { status: 400 });

    const { error: updErr } = await sb.from('quiz_sets').update(patch).eq('id', params.id);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { count, error: countErr } = await sb
      .from('quiz_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_set_id', params.id);
    if (countErr) throw countErr;
    if ((count || 0) > 0) {
      return NextResponse.json({ ok: false, error: '이미 응시 기록이 있어서 삭제할 수 없어요. 비활성화만 가능해요.' }, { status: 400 });
    }

    const { error } = await sb.from('quiz_sets').delete().eq('id', params.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
