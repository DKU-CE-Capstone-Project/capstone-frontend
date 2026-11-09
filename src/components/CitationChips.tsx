import type { V2Report } from '../data/newsMapService';
import { resolveCitations, type EvidenceNumbers } from '../data/reportEvidence';

export function CitationChips({
  newsIds,
  evidence,
  numbers,
  onSelect,
}: {
  newsIds: string[];
  evidence: V2Report['evidence'];
  numbers: EvidenceNumbers;
  onSelect: (newsId: string) => void;
}) {
  const { citations, missingCount } = resolveCitations(
    newsIds,
    evidence,
    numbers,
  );
  return (
    <div className="citation-chips" role="group" aria-label="근거 기사">
      <span className="citation-label">근거 기사</span>
      {citations.map((citation) => (
        <button
          type="button"
          className="citation-chip"
          key={citation.newsId}
          onClick={() => onSelect(citation.newsId)}
          aria-label={`근거 #${citation.number}: ${citation.title} 보기`}
        >
          #{citation.number}
        </button>
      ))}
      {missingCount > 0 && (
        <span className="citation-missing">
          인용 기사 {missingCount}건 확인 불가
        </span>
      )}
      {newsIds.length === 0 && (
        <span className="citation-missing">인용 기사 없음</span>
      )}
    </div>
  );
}
