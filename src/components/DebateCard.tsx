import type { V2Report } from '../data/newsMapService';
import { DIRECTION_LABEL, type Debate } from '../data/reportAgents';
import type { EvidenceNumbers } from '../data/reportEvidence';
import { CitationChips } from './CitationChips';

export function DebateCard({
  debate,
  evidence,
  numbers,
  onSelectEvidence,
}: {
  debate: Debate;
  evidence: V2Report['evidence'];
  numbers: EvidenceNumbers;
  onSelectEvidence: (newsId: string) => void;
}) {
  return (
    <article className={`report-agent-card report-debate-card ${debate.direction}`}>
      <div className="report-stock-heading">
        <h4>{debate.name}{debate.ticker && ` · ${debate.ticker}`}</h4>
        <span>{DIRECTION_LABEL[debate.direction]}</span>
      </div>
      <div className="report-debate-arguments">
        <DebateArguments direction="up" label="강세 논거" points={debate.bull} />
        <DebateArguments direction="down" label="약세 논거" points={debate.bear} />
      </div>
      <div className="report-debate-verdict">
        <strong>중재 판정</strong>
        <p>{debate.verdict}</p>
      </div>
      <CitationChips
        newsIds={debate.evidence_news_ids}
        evidence={evidence}
        numbers={numbers}
        onSelect={onSelectEvidence}
      />
    </article>
  );
}

function DebateArguments({
  direction,
  label,
  points,
}: {
  direction: 'up' | 'down';
  label: string;
  points: string[];
}) {
  return (
    <div className={direction}>
      <strong>{label}</strong>
      {points.length ? (
        <ul>{points.map((point, index) => <li key={index}>{point}</li>)}</ul>
      ) : (
        <p>기록된 논거가 없습니다.</p>
      )}
    </div>
  );
}
