/**
 * 맵 노드 배치 계산.
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

// ══ 뉴스 맵 ═════════════════════════════════════════════════════════

/**
 * 뉴스맵이 쓰이는 세 자리는 컨테이너 비율이 모두 다르다.
 * - 전체 화면(데스크톱): 가로로 넓음 → 연관 노드를 좌/우 부채꼴로
 * - 상세·리포트의 미니맵: 세로로 길고 좁음 → 위/아래 부채꼴로
 * - 모바일: 좁고 세로로 긺 → 위/아래 부채꼴에 각도를 더 좁게
 */
export type MapProfile = {
  field: { width: number; height: number };
  centerSize: number;
  relatedSize: number;
  radius: number;
  /** 기준축에서 좌우로 벌리는 최대 각도 */
  spread: number;
  axis: 'horizontal' | 'vertical';
};

export const NEWS_PROFILE_FULL: MapProfile = {
  field: { width: 960, height: 640 },
  centerSize: 334,
  relatedSize: 226,
  // 중심 반지름(167) + 연관 반지름(113) = 280 보다 커야 겹치지 않는다.
  // 280에 딱 붙이면 원 사이 간격이 20px라 연결선이 거의 안 보이므로 50px를 띄운다.
  radius: 330,
  // 캔버스가 가로로 길어 중심의 바로 위/아래에는 노드를 둘 수 없다.
  // |y| ≤ 320 - 113 = 207 이므로 수평축에서 asin(207/330) ≈ 38.8°가 한계다.
  spread: 38,
  axis: 'horizontal',
};

export const NEWS_PROFILE_COMPACT: MapProfile = {
  field: { width: 520, height: 720 },
  centerSize: 196,
  relatedSize: 132,
  radius: 232,
  spread: 46,
  axis: 'vertical',
};

export const NEWS_PROFILE_MOBILE: MapProfile = {
  field: { width: 380, height: 620 },
  centerSize: 190,
  relatedSize: 124,
  radius: 218,
  spread: 33,
  axis: 'vertical',
};

export function pickNewsProfile(containerWidth: number, compact: boolean): MapProfile {
  if (compact) return NEWS_PROFILE_COMPACT;
  return containerWidth < 720 ? NEWS_PROFILE_MOBILE : NEWS_PROFILE_FULL;
}

/** 한 화면에 읽을 수 있게 담기는 연관 뉴스 수 상한. */
export const MAX_RELATED_NODES = 6;

export type NewsNodeLayout = {
  id: string;
  isCenter: boolean;
  x: number;
  y: number;
  size: number;
  /** 노드 지름에 비례하되 읽을 수 있는 하한을 둔다 (미니맵·모바일에서 8px로 내려가지 않게) */
  titleFont: number;
  metaFont: number;
};

const clamp = (min: number, value: number, max: number) => Math.max(min, Math.min(max, value));

function nodeFonts(size: number, isCenter: boolean) {
  return {
    titleFont: isCenter ? clamp(12, size * 0.07, 20) : clamp(10, size * 0.062, 14),
    metaFont: clamp(9, size * 0.042, 13),
  };
}

/** k개를 -spread ~ +spread 사이에 균등 배치한 각도 목록. */
function fanAngles(k: number, spread: number): number[] {
  if (k <= 0) return [];
  if (k === 1) return [0];
  const step = (spread * 2) / (k - 1);
  return Array.from({ length: k }, (_, i) => -spread + step * i);
}

/**
 * 한쪽 부채꼴에 k개가 들어갈 때 이웃끼리 겹치지 않는 최대 지름.
 * 이웃 사이 현(chord) 길이보다 작아야 한다.
 */
function relatedSizeFor(perSide: number, profile: MapProfile): number {
  if (perSide <= 1) return profile.relatedSize;
  const gap = ((profile.spread * 2) / (perSide - 1)) * DEG;
  const chord = 2 * profile.radius * Math.sin(gap / 2);
  return Math.max(96, Math.min(profile.relatedSize, chord - 14));
}

/**
 * 중심 뉴스를 가운데 두고 연관 뉴스를 기준축 양쪽 부채꼴로 나눠 배치한다.
 * 개수에 따라 노드 지름이 자동으로 줄어든다 —
 * 기존 구현은 CSS `.related-0 ~ -2` 때문에 정확히 3개로 고정돼 있었다.
 */
export function layoutNewsMap(
  centerId: string,
  relatedIds: string[],
  profile: MapProfile = NEWS_PROFILE_FULL,
): NewsNodeLayout[] {
  const cx = profile.field.width / 2;
  const cy = profile.field.height / 2;

  const nodes: NewsNodeLayout[] = [
    {
      id: centerId,
      isCenter: true,
      x: cx,
      y: cy,
      size: profile.centerSize,
      ...nodeFonts(profile.centerSize, true),
    },
  ];

  const visible = relatedIds.slice(0, MAX_RELATED_NODES);
  const firstCount = Math.ceil(visible.length / 2);
  const size = relatedSizeFor(firstCount, profile);

  // 가로 배치는 오른쪽(0°)/왼쪽(180°), 세로 배치는 위(-90°)/아래(90°)를 기준축으로 쓴다.
  const [axisA, axisB] = profile.axis === 'horizontal' ? [0, 180] : [-90, 90];
  const angles = [
    ...fanAngles(firstCount, profile.spread).map((a) => axisA + a),
    ...fanAngles(visible.length - firstCount, profile.spread).map((a) => axisB - a),
  ];

  visible.forEach((id, i) => {
    const angle = angles[i] * DEG;
    nodes.push({
      id,
      isCenter: false,
      x: cx + profile.radius * Math.cos(angle),
      y: cy + profile.radius * Math.sin(angle),
      size,
      ...nodeFonts(size, false),
    });
  });

  return nodes;
}

/**
 * 중심에서 노드로 잇는 곡선. 두 점의 중점을 수직 방향으로 살짝 밀어 호를 만든다.
 * 기존에는 viewBox 0~100 공간에 path 3개가 리터럴로 박혀 있어
 * 노드가 어디에 있든 항상 같은 선이 그려졌다.
 */
export function connectionPath(from: NewsNodeLayout, to: NewsNodeLayout): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;

  // 노드 원 안쪽에서 시작/끝나도록 반지름만큼 당긴다.
  const startX = from.x + (dx / len) * (from.size / 2 - 8);
  const startY = from.y + (dy / len) * (from.size / 2 - 8);
  const endX = to.x - (dx / len) * (to.size / 2 - 8);
  const endY = to.y - (dy / len) * (to.size / 2 - 8);

  // 원 바깥으로 드러나는 구간만 기준으로 휜다. 전체 길이 기준으로 휘면
  // 노드가 큰 전체 맵에서 20px짜리 선이 30px씩 부풀어 끊어져 보인다.
  const visible = Math.max(12, len - from.size / 2 - to.size / 2);
  const bow = visible * 0.18;
  const midX = (startX + endX) / 2 + (-dy / len) * bow;
  const midY = (startY + endY) / 2 + (dx / len) * bow;

  return `M${startX.toFixed(1)} ${startY.toFixed(1)} Q${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
}
