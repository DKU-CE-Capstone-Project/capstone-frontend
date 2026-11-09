import type { ApiReport, ReportJob } from './newsMapService';
import type { AgentTrace } from './reportAgents';

// WP0 §9 examples. Substitute selected mock article IDs for the example IDs.
export const MOCK_MIXED_DEBATE_QUERY = '검증혼합';

const stages: ReportJob['stage'][] = [
  'queued', 'extracting', 'debating', 'judging', 'verifying',
  'revising', 'saving', 'strategy', 'done',
];
export const mockAgentStages = (mixed: boolean) =>
  mixed ? stages.filter((stage) => stage !== 'revising') : stages;

export const mockStrategyTrace: AgentTrace[] = [
  { seq: 1, agent: 'strategy', elapsed_ms: 2800, summary: '대상 1건 관망', decision: 'ok', tokens_in: 1500, tokens_out: 210 },
];

export function mockReportAgents(
  [firstNewsId, secondNewsId]: string[],
  mixed: boolean,
): Pick<ApiReport, 'stock_impacts' | 'claims' | 'debate' | 'agent_trace' | 'verification'> {
  if (mixed) {
    const evidenceIds = secondNewsId ? [firstNewsId, secondNewsId] : [firstNewsId];
    return {
      stock_impacts: [{
        name: '[mock] 다라자동차',
        ticker: null,
        direction: 'mixed',
        impact: '환율 수혜와 원자재 비용 부담이 함께 나타날 수 있습니다.',
        evidence_news_ids: evidenceIds,
      }],
      debate: [{
        name: '[mock] 다라자동차',
        ticker: null,
        bull: ['환율 상승이 수출 채산성을 개선합니다.'],
        bear: ['원자재 비용 상승이 개선폭을 상쇄할 수 있습니다.'],
        direction: 'mixed',
        verdict: '수혜와 비용 부담의 근거가 함께 있어 방향을 단정하지 않습니다.',
        evidence_news_ids: evidenceIds,
      }],
      agent_trace: [
        { seq: 1, agent: 'bull', elapsed_ms: 4120, summary: '환율 수혜 논거 1건', decision: 'ok' },
        { seq: 2, agent: 'bear', elapsed_ms: 4380, summary: '비용 부담 논거 1건', decision: 'ok' },
        { seq: 3, agent: 'judge', elapsed_ms: 6210, summary: '종목 영향 1건 혼조 판정', decision: 'ok' },
      ],
      verification: { status: 'unavailable', notes: ['로컬 fixture · 토론 판정 예시'] },
    };
  }

  return {
    stock_impacts: [{
      ticker: null,
      name: '[mock] 가나반도체',
      impact: '수출 증가 기사에 따라 단기 수요 개선 가능성이 있습니다.',
      direction: 'up',
      evidence_news_ids: [firstNewsId],
      claim_ids: ['c1'],
    }],
    claims: [{
      claim_id: 'c1',
      text: '가나반도체의 10월 수출액은 전년 동월 대비 증가했다.',
      kind: 'fact',
      evidence: [{ news_id: firstNewsId, sentence: '가나반도체의 10월 수출액은 전년 동월보다 12% 늘었다.' }],
      falsifier: '확정 수출 통계에서 증가율이 0% 이하로 정정되는 경우',
      verdict: 'supported',
      sentence_found: true,
      reason: '기사 문장이 수출 증가를 직접 언급합니다.',
    }],
    debate: [{
      name: '[mock] 가나반도체',
      ticker: null,
      bull: ['수출 증가가 단기 실적 기대를 높입니다.'],
      bear: ['단일 월 수치라 추세로 보기 어렵습니다.'],
      direction: 'up',
      verdict: '단기 개선 근거는 있으나 지속 여부는 추가 자료가 필요합니다.',
      evidence_news_ids: [firstNewsId],
    }],
    agent_trace: [
      { seq: 1, agent: 'bull', elapsed_ms: 4120, summary: '강세 논거 1건', decision: 'ok', tokens_in: 6210, tokens_out: 182 },
      { seq: 2, agent: 'bear', elapsed_ms: 4380, summary: '약세 논거 1건', decision: 'ok', tokens_in: 6240, tokens_out: 171 },
      { seq: 3, agent: 'judge', elapsed_ms: 6210, summary: '종목 영향 1건 확정, 주장 2건', decision: 'ok', tokens_in: 6800, tokens_out: 640 },
      { seq: 4, agent: 'critic', elapsed_ms: 3050, summary: '주장 2건 중 1건 원문 문장 없음', decision: 'revise_requested', tokens_in: 1200, tokens_out: 90 },
      { seq: 5, agent: 'revise', elapsed_ms: 5120, summary: '문제 주장 1건 삭제, 문제 수 1 → 0', decision: 'adopted', tokens_in: 7100, tokens_out: 620 },
    ],
    verification: {
      status: 'passed',
      notes: [],
      claims_summary: { total: 1, supported: 1, refuted: 0, unclear: 0, sentence_missing: 0 },
      revision: {
        attempts: 1,
        adopted: true,
        initial_status: 'warning',
        initial_notes: ['c2: 인용 문장을 기사 본문에서 찾지 못했습니다.'],
        rounds: [{
          round: 1,
          targets: ['c2'],
          before: 1,
          after: 0,
          decision: 'adopted',
          changes: [{
            claim_id: 'c2',
            action: 'removed',
            before_text: '가나반도체의 내년 영업이익은 두 배가 될 것이다.',
          }],
        }],
      },
    },
  };
}
