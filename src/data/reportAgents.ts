export type ImpactDirection = 'up' | 'down' | 'mixed' | 'unknown';
export const DIRECTION_LABEL: Record<ImpactDirection, string> = {
  up: '상승 요인',
  down: '하락 요인',
  mixed: '혼조',
  unknown: '방향 확인 불가',
};

export type Claim = {
  claim_id: string;
  text: string;
  kind: 'fact' | 'interpretation';
  evidence: { news_id: string; sentence: string }[];
  falsifier?: string | null;
  verdict: 'supported' | 'refuted' | 'unclear';
  sentence_found: boolean;
  reason?: string | null;
};

export type Debate = {
  name: string;
  ticker: string | null;
  bull: string[];
  bear: string[];
  direction: ImpactDirection;
  verdict: string;
  evidence_news_ids: string[];
};

export type AgentTrace = {
  seq: number;
  agent: 'analysis' | 'bull' | 'bear' | 'judge' | 'critic' | 'revise' | 'strategy';
  elapsed_ms: number;
  summary: string;
  decision: 'ok' | 'warning' | 'revise_requested' | 'adopted' | 'kept_original' | 'failed';
  tokens_in?: number | null;
  tokens_out?: number | null;
};

export type Verification = {
  status: 'passed' | 'warning' | 'unavailable';
  notes: string[];
  claims_summary?: {
    total: number;
    supported: number;
    refuted: number;
    unclear: number;
    sentence_missing: number;
  } | null;
  revision?: {
    attempts: number;
    adopted: boolean;
    initial_status: Verification['status'];
    initial_notes: string[];
    rounds: {
      round: number;
      targets: string[];
      before: number;
      after: number | null;
      decision: 'adopted' | 'kept_original' | 'failed';
      changes: { claim_id: string; action: 'rewritten' | 'removed'; before_text: string }[];
    }[];
  } | null;
};
