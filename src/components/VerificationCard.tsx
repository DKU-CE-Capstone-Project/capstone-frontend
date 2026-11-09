import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { V2Report } from '../data/newsMapService';
import type { Claim } from '../data/reportAgents';

const VERDICT_LABEL: Record<Claim['verdict'], string> = {
  supported: '지지',
  refuted: '반박',
  unclear: '판단 불가',
};

const ROUND_LABEL = {
  adopted: '수정 채택',
  kept_original: '원본 유지',
  failed: '재검증 실패',
};

export function VerificationCard({ report }: { report: V2Report }) {
  const detailsId = useId();
  const [expanded, setExpanded] = useState(false);
  const { claims, verification } = report;
  const totals = verification.claims_summary;
  const revised = verification.revision?.adopted === true;
  const rounds = verification.revision?.rounds ?? [];
  const adoptedRounds = rounds.filter((round) => round.decision === 'adopted');
  const lastAdopted = adoptedRounds[adoptedRounds.length - 1];
  const warningCount = totals ? totals.refuted + totals.unclear : verification.notes.length;
  const warnings = lastAdopted?.after != null
    ? `${rounds[0].before}건 → ${lastAdopted.after}건`
    : `${verification.status === 'passed' ? 0 : warningCount}건`;

  return (
    <section className="report-agent-card report-verification-card" aria-label="주장별 검증">
      <div className="report-verification-header">
        <div>
          <div className="report-verification-heading">
            <h3>주장별 검증</h3>
            {revised && <span className="report-verification-status passed">수정완료</span>}
            {verification.status !== 'unavailable' && (
              <span className={`report-verification-status ${verification.status}`}>
                경고 {warnings}
              </span>
            )}
            {!revised && verification.status === 'passed' && (
              <span className="report-verification-status passed">검증 통과</span>
            )}
            {verification.status === 'unavailable' && (
              <span className="report-verification-status">확인 불가</span>
            )}
          </div>
          {totals ? (
            <p>
              전체 {totals.total}건 · 지지 {totals.supported}건 · 반박 {totals.refuted}건 ·
              판단 불가 {totals.unclear}건 · 원문 문장 미확인 {totals.sentence_missing}건
            </p>
          ) : verification.revision ? (
            <p>수정·재검증 {verification.revision.attempts}회</p>
          ) : (
            <p>검증한 주장 {claims.length}건</p>
          )}
        </div>
        <button
          type="button"
          className="report-verification-toggle"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '접기' : '펼치기'}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      <div id={detailsId} hidden={!expanded}>
        <VerificationDetails report={report} />
      </div>
    </section>
  );
}

function VerificationDetails({ report }: { report: V2Report }) {
  const { claims, evidence, verification } = report;
  const rounds = verification.revision?.rounds ?? [];
  const changed = new Set(
    rounds.flatMap((round) => round.changes.map((change) => change.claim_id)),
  );
  const evidenceById = new Map(evidence.map((item) => [item.news_id, item]));

  return (
    <>
      {claims.length > 0 && (
        <ul className="report-claim-list">
          {claims.map((claim) => (
            <li key={claim.claim_id}>
              <div className="report-claim-heading">
                <strong>{claim.claim_id} · {claim.kind === 'fact' ? '사실' : '해석'}</strong>
                <span>{VERDICT_LABEL[claim.verdict]}{rounds.length > 0 && !changed.has(claim.claim_id) && ' · 유지'}</span>
              </div>
              <p>{claim.text}</p>
              {!claim.sentence_found && <p>인용 문장을 기사 본문에서 확인하지 못했습니다.</p>}
              {claim.reason && <p>판정 사유 · {claim.reason}</p>}
              {claim.falsifier && <p>반증 조건 · {claim.falsifier}</p>}
              {claim.evidence.map(({ news_id, sentence }, index) => {
                const article = evidenceById.get(news_id);
                return (
                  <blockquote key={`${news_id}-${index}`}>
                    <p>{sentence}</p>
                    {article?.source_url && (
                      <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                        원문 · {article.title}
                      </a>
                    )}
                  </blockquote>
                );
              })}
            </li>
          ))}
        </ul>
      )}
      {verification.revision && (
        <div className="report-revision">
          <h4>수정·재검증 {verification.revision.attempts}회</h4>
          {rounds.length > 0 && (
            <ol>
              {rounds.map((round) => (
                <li key={round.round}>
                  <p>
                    {round.round}차 · {ROUND_LABEL[round.decision]} · 문제 {round.before}
                    {round.after == null ? '건 · 재검증 결과 없음' : ` → ${round.after}건`}
                  </p>
                  {round.changes.length > 0 && (
                    <ul>
                      {round.changes.map((change) => (
                        <li key={change.claim_id}>
                          {change.claim_id} · {change.action === 'removed' ? '삭제' : '수정'} · {change.before_text}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}
