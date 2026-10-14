'use client';

// 아바타 원 + 머리/얼굴/목 액세서리 + 날개 + 펫 + 레벨 배지를 한 번에 그리는 공용 컴포넌트.
// 이름 선택 화면(app/kid/page.js), 친구 마이룸 목록(app/kid/room/friends/page.js), 관리자
// "아바타 꾸미기 미리보기"(app/admin/dashboard/page.js)가 전부 이 컴포넌트를 씁니다 —
// 꾸며진 모습이 보이는 곳마다 따로 구현하면 나중에 조금씩 어긋나기 쉬워서 한 곳으로 모음.
//
// 날개(wing)는 처음엔 아바타 뒤에 아주 크게 하나만 중앙에 깔았었는데, 나비/박쥐처럼
// "완전한 생물" 이모지라 아바타 자체가 그걸로 바뀐 것처럼 보이는 문제가 있었음(2026-10,
// 실제 스크린샷으로 확인). 지금은 양옆에 작게 한 쌍(왼쪽은 좌우반전)으로 띄워서 "어깨에서
// 날개가 돋아난" 느낌만 내고 아바타 본체는 안 가리게 함.

// 아바타를 아직 안 산 청소년은 전부 이 흰색 실루엣으로 통일해서 보여줍니다(동물 아바타는
// 상점에서 사서 착용하는 것이므로, 안 산 상태가 "기본값"처럼 예뻐 보이면 안 돼요).
export const DEFAULT_AVATAR_EMOJI = '👤';

function ringClass(kid) {
  if (kid.isDonationKing) return 'avatar-ring-donation';
  if (kid.isInvestKing) return 'avatar-ring-invest';
  if (kid.avatarRingDiamond) return 'avatar-ring-diamond';
  if (kid.avatarRingFire) return 'avatar-ring-fire';
  if (kid.avatarRingRainbow) return 'avatar-ring-rainbow';
  if (kid.avatarRing) return 'avatar-ring';
  return '';
}

function animClass(kid) {
  if (kid.avatarBounce) return 'avatar-anim-bounce';
  if (kid.avatarSpin) return 'avatar-anim-spin';
  if (kid.avatarPulse) return 'avatar-anim-pulse';
  if (kid.avatarWiggle) return 'avatar-anim-wiggle';
  if (kid.avatarShimmer) return 'avatar-anim-shimmer';
  return '';
}

export default function AvatarBadge({ kid, showTestBadge = false, showLevel = true }) {
  const emoji = kid.avatarEmoji || DEFAULT_AVATAR_EMOJI;

  return (
    <div className="relative">
      {kid.wingEmoji && (
        <>
          <span
            className="absolute top-1 -left-3 text-xl opacity-90 pointer-events-none"
            style={{ transform: 'scaleX(-1)' }}
          >
            {kid.wingEmoji}
          </span>
          <span className="absolute top-1 -right-3 text-xl opacity-90 pointer-events-none">{kid.wingEmoji}</span>
        </>
      )}
      <div
        className={`icon-badge icon-badge-gray w-12 h-12 rounded-full text-2xl ${ringClass(kid)} ${
          kid.starTrail ? 'avatar-star-trail' : ''
        } ${animClass(kid)}`}
      >
        {emoji}
      </div>
      {kid.accessoryHeadEmoji && (
        <span className="absolute -top-1.5 -right-1.5 text-base leading-none">{kid.accessoryHeadEmoji}</span>
      )}
      {kid.accessoryFaceEmoji && (
        <span className="absolute -top-1.5 -left-1.5 text-base leading-none">{kid.accessoryFaceEmoji}</span>
      )}
      {kid.accessoryNeckEmoji && (
        <span className="absolute -bottom-1 -right-1 text-sm leading-none">{kid.accessoryNeckEmoji}</span>
      )}
      {kid.petEmoji && (
        <span className="absolute top-1/2 -right-4 -translate-y-1/2 text-sm leading-none">{kid.petEmoji}</span>
      )}
      {showTestBadge && kid.isTest && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] bg-navy text-white rounded-full px-1 leading-tight">
          🧪
        </span>
      )}
      {showLevel && kid.level != null && (
        <span className="icon-badge icon-badge-grape absolute -bottom-1 -left-1 w-5 h-5 rounded-full text-[8.5px] font-display text-white">
          {kid.level}
        </span>
      )}
    </div>
  );
}
