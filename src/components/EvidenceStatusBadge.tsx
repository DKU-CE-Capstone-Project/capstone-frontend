import type { EvidenceStatus } from '../data/reportEvidence';

export const EVIDENCE_STATUS_LABEL: Record<EvidenceStatus, string> = {
  used: '본문 사용',
  failed: '본문 실패',
  conflict: '결과 확인 필요',
};

export function EvidenceStatusBadge({ status }: { status: EvidenceStatus | null }) {
  if (!status) return null;
  return (
    <span className={`map-evidence-status is-${status}`} aria-hidden="true">
      {EVIDENCE_STATUS_LABEL[status]}
    </span>
  );
}
