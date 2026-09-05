import { cookies } from 'next/headers';
import crypto from 'crypto';

const KID_COOKIE = 'gc_kid_session';
const ADMIN_COOKIE = 'gc_admin_session';
const KID_MAX_AGE = 60 * 60 * 24 * 60; // 60일
const ADMIN_MAX_AGE = 60 * 60 * 8; // 8시간

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error('SESSION_SECRET 환경변수가 없어요. .env.local 에 추가해주세요.');
  }
  return s;
}

function sign(value) {
  const h = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  return `${value}.${h}`;
}

function unsign(signed) {
  if (!signed || !signed.includes('.')) return null;
  const idx = signed.lastIndexOf('.');
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export function setKidSession(kidId) {
  cookies().set(KID_COOKIE, sign(kidId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: KID_MAX_AGE,
  });
}

export function getKidId() {
  const raw = cookies().get(KID_COOKIE)?.value;
  return raw ? unsign(raw) : null;
}

export function clearKidSession() {
  cookies().delete(KID_COOKIE);
}

export function setAdminSession() {
  cookies().set(ADMIN_COOKIE, sign('admin'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: ADMIN_MAX_AGE,
  });
}

export function isAdmin() {
  const raw = cookies().get(ADMIN_COOKIE)?.value;
  return !!raw && unsign(raw) === 'admin';
}

export function clearAdminSession() {
  cookies().delete(ADMIN_COOKIE);
}
