import type { V2Report } from '../data/newsMapService';
import { matchingImpacts, type EvidenceNumbers } from '../data/reportEvidence';
import { CitationChips } from './CitationChips';

const ACTION_LABEL = {
  buy: '매수 관점',
  hold: '보유 관점',
  sell: '매도 관점',
  watch: '관망',
};
const DIRECTION_LABEL = {
  up: '상승 요인',
  down: '하락 요인',
  mixed: '혼조',
  unknown: '방향 확인 불가',
};

export function EvidenceChain({
  report,
  numbers,
  onSelect,
}: {
  report: V2Report;
  numbers: EvidenceNumbers;
  onSelect: (newsId: string) => void;
}) {
  if (!report.strategyItems.length) return null;
  return (
    <section
      className="report-text evidence-chain"
      aria-label="전략의 분석 근거"
    >
      <h3>전략의 분석 근거</h3>
      <p className="evidence-chain-intro">
        전략 대상과 이름·종목 코드가 같은 리포트 영향을 연결했습니다.
      </p>
      {report.strategyItems.map((item, index) => {
        const impacts = matchingImpacts(item, report.stockImpacts);
        return (
          <article
            className="evidence-chain-item"
            key={`${item.stock_name}-${index}`}
          >
            <div className="evidence-chain-step">
              <span className="evidence-chain-label">전략</span>
              <strong>
                {item.stock_name}
                {item.ticker ? ` (${item.ticker})` : ''} ·{' '}
                {ACTION_LABEL[item.action]}
              </strong>
              <p>{item.reason}</p>
            </div>
            {impacts.length === 0 ? (
              <p className="evidence-chain-missing">
                연결된 종목 영향을 찾을 수 없습니다.
              </p>
            ) : (
              impacts.map((impact, impactIndex) => (
                <div className="evidence-chain-step" key={impactIndex}>
                  <span className="evidence-chain-label">
                    리포트 종목 영향 · {DIRECTION_LABEL[impact.direction]}
                  </span>
                  <p>{impact.impact}</p>
                  <CitationChips
                    newsIds={impact.evidence_news_ids}
                    evidence={report.evidence}
                    numbers={numbers}
                    onSelect={onSelect}
                  />
                </div>
              ))
            )}
          </article>
        );
      })}
    </section>
  );
}
