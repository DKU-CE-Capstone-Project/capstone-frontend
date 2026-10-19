import { useEffect, useState } from 'react';

/**
 * Decision API(뉴스 선별)는 첫 호출에 8초 안팎이 걸린다 (econmind-docs docs/14, docs/99).
 * 서버가 진행률을 주지 않으므로 퍼센트·진행 막대 대신 경과 시간에 따라 문구만 바꾼다.
 * 마지막 단계는 끝을 약속하지 않고 늦어지고 있다는 사실만 알린다.
 */
export type LoadingStage = {
  step: number;
  label: string;
  /** 평소보다 오래 걸리는 중 */
  slow: boolean;
};

/** 각 단계가 시작되는 경과 시간(ms). 첫 단계는 0ms. */
export const LOADING_STAGE_AT = [0, 2500, 6000, 15000] as const;

const LATER_LABELS = [
  '관련 기사 고르는 중…',
  '거의 다 됐어요…',
  '평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요',
] as const;

export function loadingStage(
  elapsedMs: number,
  first = '뉴스 검색 중…',
): LoadingStage {
  let step = 0;
  for (let i = 1; i < LOADING_STAGE_AT.length; i++)
    if (elapsedMs >= LOADING_STAGE_AT[i]) step = i;
  return {
    step,
    label: step === 0 ? first : LATER_LABELS[step - 1],
    slow: step === LOADING_STAGE_AT.length - 1,
  };
}

/** 다음 단계까지 남은 시간(ms). 마지막 단계면 null — 더 바뀔 문구가 없어 타이머를 멈춘다. */
export function nextStageIn(elapsedMs: number): number | null {
  const next = LOADING_STAGE_AT.find((at) => at > Math.max(0, elapsedMs));
  return next === undefined ? null : next - Math.max(0, elapsedMs);
}

/**
 * key가 null이 아니면 그 요청의 경과 시간 단계를 돌려준다. key가 바뀌면 처음 단계부터 다시 센다.
 * 단계가 바뀌는 시점에만 타이머가 깨어나므로 매초 다시 그리지 않는다.
 */
export function useLoadingStage(
  key: string | number | null,
  first?: string,
): LoadingStage | null {
  // 단계를 요청 key와 함께 저장해, key가 바뀐 첫 렌더에 이전 요청의 단계가 보이지 않게 한다.
  const [seen, setSeen] = useState<{ key: typeof key; step: number }>({
    key,
    step: 0,
  });
  useEffect(() => {
    if (key === null) return;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const elapsed = Date.now() - started;
      setSeen({ key, step: loadingStage(elapsed).step });
      const wait = nextStageIn(elapsed);
      if (wait !== null) timer = setTimeout(tick, wait);
    };
    tick();
    return () => clearTimeout(timer);
  }, [key]);
  if (key === null) return null;
  const step = seen.key === key ? seen.step : 0;
  return loadingStage(LOADING_STAGE_AT[step], first);
}
