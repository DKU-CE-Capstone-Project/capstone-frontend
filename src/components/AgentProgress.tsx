import { useEffect, useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { phaseOf, STAGE_LABEL, type ReportJob } from '../data/newsMapService';

type Stage = ReportJob['stage'];
/** 서버가 강세·약세 토론을 거치는지(debate) 아닌지(plain). */
export type ReportTrack = 'debate' | 'plain';
export type AgentStep = {
  stage: Stage;
  state: 'done' | 'current' | 'waiting' | 'skipped';
};

const LEGACY_STEPS = [
  '본문 추출',
  '사건·시장 영향 분석 및 검증',
  '전략 생성 및 저장',
];
/** 서버가 내보내는 stage 순서. 토론이 실패하면 debating 다음에 analyzing이 온다. */
const ORDER: Stage[] = [
  'queued',
  'extracting',
  'debating',
  'judging',
  'analyzing',
  'verifying',
  'revising',
  'saving',
  'strategy',
  'done',
];
const TRACK_KEY = 'econmind.v2.report-track';

/**
 * 서버는 토론 사용 여부를 작업 응답에 담지 않는다. 직전 작업에서 본 경로를 기억해 다음 작업의
 * 첫 화면부터 같은 단계 목록을 보여 준다. 본 적이 없으면 토론 경로로 시작한다.
 */
function rememberedTrack(): ReportTrack {
  try {
    return localStorage.getItem(TRACK_KEY) === 'plain' ? 'plain' : 'debate';
  } catch {
    return 'debate';
  }
}
function rememberTrack(track: ReportTrack) {
  try {
    localStorage.setItem(TRACK_KEY, track);
  } catch {
    /* Browser storage is optional. */
  }
}

/** 이번 작업에서 본 stage로 확인한 경로. 아직 갈림길 전이면 null. */
function observedTrack(stages: Stage[]): ReportTrack | null {
  if (stages.includes('debating') || stages.includes('judging')) return 'debate';
  return stages.includes('analyzing') ? 'plain' : null;
}

/**
 * 처음부터 끝까지의 단계 목록. 토론 없는 기존 경로는 null을 돌려 세 단계 표시를 유지한다.
 * 조건부 단계(주장 수정, 토론 실패 뒤의 일반 분석)는 서버가 실제로 알렸을 때만 넣는다.
 */
export function agentSteps(
  observed: Stage[],
  fallback: ReportTrack,
  reused = false,
): AgentStep[] | null {
  const stage = observed[observed.length - 1];
  const track = observedTrack(observed) ?? fallback;
  const revised = observed.includes('revising');
  if (track === 'plain' && !revised) return null;

  const failedDebate = track === 'debate' && observed.includes('analyzing');
  const stages: Stage[] = [
    'extracting',
    ...(track === 'debate' ? (['debating', 'judging'] as const) : []),
    ...(track === 'plain' || failedDebate ? (['analyzing'] as const) : []),
    'verifying',
    ...(revised ? (['revising'] as const) : []),
    'saving',
    'strategy',
  ];
  const at = ORDER.indexOf(stage === 'queued' ? 'extracting' : stage);
  return stages.map((item) => {
    const index = ORDER.indexOf(item);
    if (index === at) return { stage: item, state: 'current' };
    if (index > at) return { stage: item, state: 'waiting' };
    // 지나간 단계는 폴링 사이에 끝났을 수 있어 완료로 본다. 실행하지 않은 근거가 있을 때만 건너뜀이다.
    const skipped =
      !observed.includes(item) &&
      item !== 'extracting' &&
      (reused || (item === 'judging' && failedDebate));
    return { stage: item, state: skipped ? 'skipped' : 'done' };
  });
}

export function AgentProgress({
  stage,
  reused = false,
}: {
  stage: Stage;
  /** 저장된 리포트를 재사용해 분석 단계를 실행하지 않은 작업 */
  reused?: boolean;
}) {
  const [observed, setObserved] = useState<Stage[]>([stage]);
  useEffect(() => {
    setObserved((stages) =>
      stages.includes(stage) ? stages : [...stages, stage],
    );
  }, [stage]);
  const stages = observed.includes(stage) ? observed : [...observed, stage];
  const [fallback] = useState(rememberedTrack);
  const seen = observedTrack(stages);
  useEffect(() => {
    if (seen) rememberTrack(seen);
  }, [seen]);
  const steps = agentSteps(stages, fallback, reused);
  const phase = phaseOf(stage);

  return (
    <ol className="report-steps" aria-label="리포트 생성 진행">
      {steps
        ? steps.map((step) => (
            <li
              key={step.stage}
              className={stepClass(step.state)}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              <StepIndicator state={step.state} />
              {step.stage === 'debating' ? (
                <div className="agent-progress-parallel" aria-label="병렬 분석">
                  <span>강세 분석</span>
                  <span>약세 분석</span>
                </div>
              ) : (
                <span>{STAGE_LABEL[step.stage]}</span>
              )}
              {step.state === 'skipped' && (
                <span className="report-step-note">
                  {reused ? '기존 결과 사용' : '건너뜀'}
                </span>
              )}
            </li>
          ))
        : LEGACY_STEPS.map((label, index) => {
            const state =
              phase === index ? 'current' : phase > index ? 'done' : 'waiting';
            return (
              <li
                key={label}
                className={stepClass(state)}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <StepIndicator state={state} />
                <span>{label}</span>
              </li>
            );
          })}
    </ol>
  );
}

function stepClass(state: AgentStep['state']) {
  if (state === 'waiting') return 'report-step';
  return `report-step ${state === 'skipped' ? 'is-skipped' : 'is-reached'}`;
}

function StepIndicator({ state }: { state: AgentStep['state'] }) {
  if (state === 'current')
    return <span className="step-active" aria-hidden="true" />;
  if (state === 'waiting')
    return <span className="step-wait" aria-hidden="true" />;
  if (state === 'skipped')
    return (
      <span className="step-skip">
        <Minus size={13} strokeWidth={3} aria-hidden="true" />
      </span>
    );
  return (
    <span className="step-done">
      <Check size={13} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}
