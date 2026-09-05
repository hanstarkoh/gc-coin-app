import { NextResponse } from 'next/server';
import { clearKidSession } from '@/lib/session';

export async function POST() {
  clearKidSession();
  return NextResponse.json({ ok: true });
}
