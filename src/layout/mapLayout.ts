/**
 * 키워드 맵 노드 배치 계산. (뉴스맵 배치는 newsTree.ts)
 *
 * 기존에는 `.keyword-map-node-0` ~ `-10`, `.related-0` ~ `-2`가 CSS에 좌표로
 * 하드코딩되어 있었고, 브레이크포인트마다 같은 좌표를 다시 적었다(styles.css의 23%).
 * 노드 수가 바뀌면 화면이 깨지고, 위치가 CSS에 있으니 애니메이션도 불가능했다.
 *
 * 여기서는 고정된 "설계 공간"(design space) 안에서 극좌표로 위치를 계산하고,
 * 실제 컨테이너 크기에 맞춰 stage에 scale만 곱한다. 좌표가 JS 값이 되므로
 * 중심 노드를 바꿀 때 Motion이 위치 변화를 보간할 수 있다.
 *
 * 설계 공간을 하나만 두고 축소하면 미니맵·모바일에서 글자가 8px 아래로 내려가므로,
 * 컨테이너 비율이 다른 곳마다 프로필을 따로 둔다.
 */

const DEG = Math.PI / 180;

// ══ 키워드 맵 ═══════════════════════════════════════════════════════

type Ring = {
  rx: number;
  ry: number;
  size: number;
  fontSize: number;
  angles: number[];
};

export type KeywordProfile = {
  field: { width: number; height: number };
  center: { size: number; fontSize: number };
  /**
   * 안쪽 궤도는 대각선(±45°), 바깥 궤도는 십자(0°/90°/180°/270°)에 둔다.
   * 두 궤도의 각도가 45°씩 어긋나고 반지름도 다르므로 노드가 서로 겹치지 않는다.
   */
  inner: Ring;
  outer: Ring;
};

export const KEYWORD_PROFILE_FULL: KeywordProfile = {
  field: { width: 930, height: 620 },
  center: { size: 208, fontSize: 26 },
  inner: { rx: 245, ry: 180, size: 118, fontSize: 17, angles: [-45, -135, 135, 45] },
  outer: { rx: 352, ry: 250, size: 86, fontSize: 13, angles: [-90, 0, 90, 180] },
};

export const KEYWORD_PROFILE_MOBILE: KeywordProfile = {
  field: { width: 370, height: 560 },
  center: { size: 132, fontSize: 17 },
  inner: { rx: 110, ry: 130, size: 84, fontSize: 12, angles: [-45, -135, 135, 45] },
  outer: { rx: 144, ry: 200, size: 68, fontSize: 11, angles: [-90, 0, 90, 180] },
};

export function pickKeywordProfile(containerWidth: number): KeywordProfile {
  return containerWidth < 720 ? KEYWORD_PROFILE_MOBILE : KEYWORD_PROFILE_FULL;
}

/** 중심 1 + 안쪽 4 + 바깥 4. API 기본 추천 키워드 8개 + 검색어와 정확히 맞는다. */
export const MAX_KEYWORD_NODES = 9;

export type KeywordNode = {
  keyword: string;
  /** 0 = 중심(검색어), 1~4 = 안쪽 궤도, 5~8 = 바깥 궤도 */
  rank: number;
  /** 설계 공간 기준 중심 좌표 (px) */
  x: number;
  y: number;
  size: number;
  fontSize: number;
};

export function layoutKeywordMap(
  keywords: string[],
  profile: KeywordProfile = KEYWORD_PROFILE_FULL,
): KeywordNode[] {
  const cx = profile.field.width / 2;
  const cy = profile.field.height / 2;

  return keywords.slice(0, MAX_KEYWORD_NODES).map((keyword, rank) => {
    if (rank === 0) {
      return { keyword, rank, x: cx, y: cy, ...profile.center };
    }

    const innerCount = profile.inner.angles.length;
    const ring = rank <= innerCount ? profile.inner : profile.outer;
    const slot = rank <= innerCount ? rank - 1 : rank - 1 - innerCount;
    const angle = ring.angles[slot % ring.angles.length] * DEG;

    return {
      keyword,
      rank,
      x: cx + ring.rx * Math.cos(angle),
      y: cy + ring.ry * Math.sin(angle),
      size: ring.size,
      fontSize: ring.fontSize,
    };
  });
}

/** 장식용 궤도 링 (키워드 맵 배경). */
export function orbitRings(profile: KeywordProfile) {
  return [
    { rx: profile.inner.rx, ry: profile.inner.ry },
    { rx: profile.outer.rx, ry: profile.outer.ry },
  ];
}
