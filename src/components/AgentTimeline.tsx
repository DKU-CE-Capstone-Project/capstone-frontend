import type { V2Report } from '../data/newsMapService';
import type { AgentTrace } from '../data/reportAgents';

const AGENT_LABEL: Record<AgentTrace['agent'], string> = {
  analysis: '사건·시장 영향 분석',
  bull: '강세 분석가',
  bear: '약세 분석가',
  judge: '중재',
  critic: '근거 검증',
  revise: '주장 수정·재검증',
  strategy: '전략',
};

const DECISION_LABEL: Record<AgentTrace['decision'], string> = {
  ok: '통과',
  warning: '경고',
  revise_requested: '수정 요청',
  adopted: '수정 채택',
  kept_original: '원본 유지',
  failed: '실패',
};

function isDebateAnalyst(agent?: AgentTrace['agent']) {
  return agent === 'bull' || agent === 'bear';
}

export function AgentTimeline({
  reportTrace,
  strategyTrace,
  coverage,
  reportReused,
  isExample,
}: Pick<V2Report, 'reportTrace' | 'strategyTrace' | 'coverage'> & {
  reportReused: boolean;
  isExample: boolean;
}) {
  if (!reportTrace.length && !strategyTrace.length) return null;

  const entries = [...reportTrace, ...strategyTrace];

  return (
    <details className="report-agent-timeline report-agent-card">
      <summary>에이전트 실행 기록 · {entries.length + 1}건</summary>
      <div className="agent-timeline-meta">
        {isExample && <span className="agent-timeline-example">예시 화면</span>}
        <span>단계별 소요 시간</span>
      </div>
      {reportReused && reportTrace.length > 0 && (
        <p className="agent-timeline-note">리포트 기록은 이전 생성 작업에서 가져왔습니다.</p>
      )}
      <ol aria-label="실행 순서">
        <li className="agent-timeline-entry">
          <span className="agent-timeline-time" aria-label="소요 시간 기록 없음">—</span>
          <span className="agent-timeline-marker" aria-hidden="true" />
          <div className="agent-timeline-content">
            <strong>본문 추출</strong>{' '}
            요청 {coverage.requested_count} · 사용 {coverage.used_count} · 실패 {coverage.failed_count}
          </div>
        </li>
        {entries.map((entry, index) => {
          const previousAgent = entries[index - 1]?.agent;
          const parallel = isDebateAnalyst(entry.agent) &&
            isDebateAnalyst(previousAgent) && entry.agent !== previousAgent;
          const showDecision = entry.decision !== 'ok' || entry.agent === 'critic';

          return (
            <li
              className="agent-timeline-entry"
              data-agent={entry.agent}
              key={`${index < reportTrace.length ? 'report' : 'strategy'}-${entry.seq}`}
            >
              <span className="agent-timeline-time">{(entry.elapsed_ms / 1000).toFixed(1)}s</span>
              <span className="agent-timeline-marker" aria-hidden="true" />
              <div className="agent-timeline-content">
                <strong>{AGENT_LABEL[entry.agent]}</strong>
                {entry.summary && <> {entry.summary}</>}
                {parallel && <span className="agent-timeline-parallel"> (병렬)</span>}
                {showDecision && (
                  <span className="agent-timeline-decision" data-decision={entry.decision}>
                    {DECISION_LABEL[entry.decision]}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
