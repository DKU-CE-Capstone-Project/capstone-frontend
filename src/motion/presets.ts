/**
 * 애니메이션 프리셋.
 *
 * 개별 컴포넌트에서 transition 값을 즉흥적으로 쓰지 말고 여기 정의된 것을 쓴다.
 * 모든 프리셋은 prefers-reduced-motion에서 무력화되도록 설계돼 있다 —
 * `useMotionSafe()`가 false면 컴포넌트는 variants 대신 정적 렌더를 선택한다.
 */

import { useReducedMotion } from 'motion/react';
import type { Transition, Variants } from 'motion/react';

// ── 트랜지션 ────────────────────────────────────────────────────────
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 28,
  mass: 1,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 20,
  mass: 0.7,
};

export const easeOut: Transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };
export const easeOutSlow: Transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] };

/** reduced-motion 사용자에게는 애니메이션을 끄고 최종 상태만 보여준다. */
export function useMotionSafe(): boolean {
  return !useReducedMotion();
}

// ── 화면 전환 ───────────────────────────────────────────────────────
// 5개 화면이 모두 position:absolute로 겹쳐 있어 cross-fade가 자연스럽다.
export const screenVariants: Variants = {
  enter: { opacity: 0, y: 12, scale: 0.99 },
  center: { opacity: 1, y: 0, scale: 1, transition: { ...easeOutSlow, staggerChildren: 0.05 } },
  exit: { opacity: 0, y: -8, scale: 0.995, transition: { duration: 0.18, ease: 'easeIn' } },
};

// ── 컨테이너 stagger ────────────────────────────────────────────────
export function staggerContainer(stagger = 0.06, delay = 0): Variants {
  return {
    enter: {},
    center: { transition: { staggerChildren: stagger, delayChildren: delay } },
    exit: {},
  };
}

// ── 맵 노드 ─────────────────────────────────────────────────────────
/** 중심에서 바깥으로 튀어나오듯 등장한다. */
export const mapNodeVariants: Variants = {
  enter: { opacity: 0, scale: 0.4 },
  center: { opacity: 1, scale: 1, transition: springBouncy },
  exit: { opacity: 0, scale: 0.6, transition: { duration: 0.15 } },
};

/** SVG 연결선 draw-on. pathLength는 Motion이 stroke-dasharray로 변환해준다. */
export const edgeVariants: Variants = {
  enter: { pathLength: 0, opacity: 0 },
  center: {
    pathLength: 1,
    opacity: 1,
    transition: { pathLength: { duration: 0.6, ease: 'easeOut' }, opacity: { duration: 0.2 } },
  },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ── 리스트 아이템 (리포트 블록, 종목 카드, 칩) ──────────────────────
export const riseVariants: Variants = {
  enter: { opacity: 0, y: 14 },
  center: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: easeOut },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

// ── 오버레이 / 토스트 ───────────────────────────────────────────────
export const overlayVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

export const toastVariants: Variants = {
  enter: { opacity: 0, y: -12, scale: 0.96 },
  center: { opacity: 1, y: 0, scale: 1, transition: springSnappy },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.16 } },
};

// ── 인터랙션 (hover / tap) ──────────────────────────────────────────
export const pressable = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: springSnappy,
} as const;

export const nodeHover = {
  whileHover: { scale: 1.06, y: -4 },
  whileTap: { scale: 0.98 },
  transition: springSnappy,
} as const;

/**
 * 노드가 제자리에서 미세하게 떠 있는 느낌.
 * 인덱스마다 위상을 어긋나게 해서 전체가 한 덩어리로 움직이지 않게 한다.
 */
export function floatAnimation(index: number, amplitude = 6) {
  return {
    y: [0, -amplitude, 0],
    transition: {
      duration: 4.5 + (index % 4) * 0.7,
      repeat: Infinity,
      ease: 'easeInOut' as const,
      delay: (index % 5) * 0.35,
    },
  };
}
