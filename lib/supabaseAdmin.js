import { createClient } from '@supabase/supabase-js';

// 이 클라이언트는 서버(API 라우트)에서만 사용됩니다.
// SUPABASE_SERVICE_ROLE_KEY 는 절대 브라우저로 노출되면 안 됩니다 (NEXT_PUBLIC_ 접두사 사용 금지).
let cachedClient = null;

export function supabaseAdmin() {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase 환경변수가 설정되지 않았어요. .env.local 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 넣어주세요.'
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cachedClient;
}
