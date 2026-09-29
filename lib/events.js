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

// 이벤트를 한 아이당 평생 한 번만 완료할 수 있는지(일회성), 매일 다시 도전 가능한지(반복형).
// repeat_type 컬럼이 없거나(마이그레이션 전) null이면 'once'로 취급합니다(하루 지나면
// 또 완료 신청하는 걸 막고 싶어서 바꾼 최근 기본 동작을 그대로 유지하기 위함).
export const EVENT_REPEAT_TYPES = [
  { key: 'once', label: '일회성' },
  { key: 'repeatable', label: '반복형' },
];

export function eventRepeatLabel(repeatType) {
  return EVENT_REPEAT_TYPES.find((t) => t.key === repeatType)?.label || '일회성';
}

export function isRepeatableEvent(repeatType) {
  return repeatType === 'repeatable';
}
