import type { V2Report } from './newsMapService';

type UsedEvidence = V2Report['evidence'];
type EvidenceResult = Pick<V2Report, 'evidence' | 'failedEvidence'>;
export type EvidenceNumbers = Map<string, number>;
export type EvidenceStatus = 'used' | 'failed' | 'conflict';

/** Keep the same numbers as the selected-news list and map nodes. */
export function numberEvidence(newsIds: string[]): EvidenceNumbers {
  return new Map(newsIds.map((id, index) => [id, index + 1]));
}

/** A badge describes only a completed report, never a selection or a job count. */
export function evidenceStatus(
  report: EvidenceResult | null,
  newsId: string,
): EvidenceStatus | null {
  if (!report) return null;
  const used = report.evidence.some((item) => item.news_id === newsId);
  const failed = report.failedEvidence.some((item) => item.news_id === newsId);
  if (used && failed) return 'conflict';
  return used ? 'used' : failed ? 'failed' : null;
}

/** Resolve only citations that actually appear in the report's used evidence. */
export function resolveCitations(
  newsIds: string[],
  evidence: UsedEvidence,
  numbers: EvidenceNumbers,
) {
  const byId = new Map(evidence.map((item) => [item.news_id, item]));
  const citations: Array<{ newsId: string; title: string; number: number }> = [];
  let missingCount = 0;
  for (const newsId of new Set(newsIds)) {
    const item = byId.get(newsId);
    const number = numbers.get(newsId);
    if (!item || number === undefined) {
      missingCount++;
      continue;
    }
    citations.push({ newsId, title: item.title, number });
  }
  return { citations, missingCount };
}

/** The strategy API has no impact ID; only an exact name and ticker can be matched. */
export function matchingImpacts(
  item: V2Report['strategyItems'][number],
  impacts: V2Report['stockImpacts'],
) {
  return impacts.filter(
    (impact) => impact.name === item.stock_name && impact.ticker === item.ticker,
  );
}
