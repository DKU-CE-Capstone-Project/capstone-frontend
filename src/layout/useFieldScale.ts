import { useEffect, useRef, useState } from 'react';

/**
 * 컨테이너 크기를 관찰해 설계 공간(고정 px) → 실제 크기 배율을 구한다.
 *
 * 이 훅 덕분에 브레이크포인트마다 노드 좌표를 다시 적을 필요가 없다.
 * (기존 styles.css는 1023px·720px 미디어쿼리에서 같은 노드 좌표를 274줄에 걸쳐 반복했다.)
 *
 * `width`는 프로필 선택에 쓰이므로 설계 공간보다 먼저 확정돼야 한다 —
 * 그래서 측정값과 배율을 함께 돌려준다.
 */
export function useFieldSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      setSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

/** 설계 공간이 컨테이너 안에 완전히 들어가는 배율. 확대는 하지 않는다. */
export function fitScale(
  container: { width: number; height: number },
  design: { width: number; height: number },
  max = 1,
): number {
  if (container.width === 0 || container.height === 0) return max;
  return Math.min(container.width / design.width, container.height / design.height, max);
}
