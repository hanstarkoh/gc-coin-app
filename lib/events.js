// 이벤트 포스터 이미지. 파일 자체는 Supabase Storage의 별도 버킷에 저장하고,
// events 테이블에는 그 경로(poster_path)만 남겨서 이벤트 삭제/포스터 교체 시
// 스토리지에서도 같이 지워 용량이 계속 쌓이지 않게 합니다.

export const EVENT_POSTER_BUCKET = 'event-posters';
export const EVENT_POSTER_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const EVENT_POSTER_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function eventPosterUrl(sb, path) {
  if (!path) return null;
  return sb.storage.from(EVENT_POSTER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function deleteEventPoster(sb, path) {
  if (!path) return;
  try {
    await sb.storage.from(EVENT_POSTER_BUCKET).remove([path]);
  } catch {
    // 스토리지 정리 실패는 무시 — DB 쪽 처리(이벤트 삭제 등)는 계속 진행합니다.
  }
}
