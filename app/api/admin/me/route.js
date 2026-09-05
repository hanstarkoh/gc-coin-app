import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/session';

export async function GET() {
  return NextResponse.json({ ok: true, isAdmin: isAdmin() });
}
