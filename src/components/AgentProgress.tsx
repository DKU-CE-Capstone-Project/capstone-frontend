import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { phaseOf, STAGE_LABEL, type ReportJob } from '../data/newsMapService';

type Stage = ReportJob['stage'];
const LEGACY_STEPS = [
  '본문 추출',
  '사건·시장 영향 분석 및 검증',
  '전략 생성 및 저장',
];
const AGENT_STAGES: Stage[] = ['debating', 'judging', 'revising'];

export function AgentProgress({ stage }: { stage: Stage }) {
  const [observed, setObserved] = useState<Stage[]>([stage]);
  useEffect(() => {
    setObserved((stages) =>
      stages.includes(stage) ? stages : [...stages, stage],
    );
  }, [stage]);
  const stages = observed.includes(stage) ? observed : [...observed, stage];
  const detailed = stages.some((item) => AGENT_STAGES.includes(item));
  const phase = phaseOf(stage);

  return (
    <ol className="report-steps" aria-label="리포트 생성 진행">
      {detailed
        ? stages.map((item) => (
            <li
              key={item}
              className="report-step is-reached"
              aria-current={item === stage ? 'step' : undefined}
            >
              <StepIndicator current={item === stage} reached />
              {item === 'debating' ? (
                <div className="agent-progress-parallel" aria-label="병렬 분석">
                  <span>강세 분석</span>
                  <span>약세 분석</span>
                </div>
              ) : (
                <span>{STAGE_LABEL[item]}</span>
              )}
            </li>
          ))
        : LEGACY_STEPS.map((label, index) => (
            <li
              key={label}
              className={`report-step${phase >= index ? ' is-reached' : ''}`}
              aria-current={phase === index ? 'step' : undefined}
            >
              <StepIndicator current={phase === index} reached={phase >= index} />
              <span>{label}</span>
            </li>
          ))}
    </ol>
  );
}

function StepIndicator({ current, reached }: { current: boolean; reached: boolean }) {
  if (current) return <span className="step-active" aria-hidden="true" />;
  if (!reached) return <span className="step-wait" aria-hidden="true" />;
  return (
    <span className="step-done">
      <Check size={13} strokeWidth={3} aria-hidden="true" />
    </span>
  );
}
