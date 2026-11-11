/** Canonical docs/10 contract + grounded Zero-LLM keyword map (/api/v1/keywords/map). */
import type { NewsCard, Report } from './mockData';
import {
  MOCK_HOME_KEYWORDS,
  fetchMockKeywordMap,
  fetchMockRecommendedKeywords,
  type MockKeywordMap,
} from './mockNewsMap';
import { mockV2Request } from './mockV2';
import type { AgentTrace, Claim, Debate, ImpactDirection, Verification } from './reportAgents';

export type KeywordMapNodeMeta = {
  keyword: string;
  kind: 'center' | 'issue' | 'entity';
  search_query: string;
  article_count: number;
  center_news_id?: string | null;
  news_ids?: string[];
};
export type KeywordMapData = MockKeywordMap & {
  total_articles?: number;
  nodes?: KeywordMapNodeMeta[];
};
export const DEFAULT_HOME_KEYWORDS = MOCK_HOME_KEYWORDS;
export type ReportPhase = 0 | 1 | 2 | 3;
export type ErrorDetail = {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
};
export type Session = {
  session_epoch: string;
  resumed: boolean;
  expires_at: string;
  prototype_tier: 'FREE' | 'PAID';
  capabilities: {
    max_report_articles: number;
    initial_related_target: number;
    branch_related_target: number;
    max_map_nodes: number;
    max_map_depth: number;
  };
};
export type ApiCard = {
  news_id: string;
  title: string;
  description: string;
  source_name: string;
  published_at: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  keywords: string[];
  categories: string[];
};
export type Selection = {
  status: 'complete' | 'insufficient' | 'partial';
  reason: string | null;
  requested: number;
  returned: number;
  shortage: boolean;
  budget_exhausted: boolean;
};
export type ApiNode = {
  node_id: string;
  news_id: string;
  parent_node_id: string | null;
  level: number;
  expanded: boolean;
  batch: number;
  news: ApiCard;
};
export type ApiMap = {
  map_id: string;
  revision: number;
  query: string;
  state: 'active' | 'empty';
  root_node_id: string | null;
  nodes: ApiNode[];
  branches: Array<{
    parent_node_id: string;
    child_node_ids: string[];
    display_selection: Selection;
    last_attempt: Selection;
  }>;
  initial_selection: Selection;
  next_issue?: { news_id: string; title: string } | null;
  can_find_next_issue?: boolean;
  previous_issue_map_id?: string | null;
  selected_news_ids: string[];
  detail_news_id: string | null;
  report_panel_open: boolean;
  active_report_job_id: string | null;
  last_result: { report_id: string; strategy_id: string | null } | null;
  expires_at: string;
};
export type ReportJob = {
  job_id: string;
  client_request_id: string;
  map_id: string;
  accepted_map_revision: number;
  status:
    | 'queued'
    | 'running'
    | 'cancel_requested'
    | 'completed'
    | 'failed'
    | 'cancelled';
  stage:
    | 'queued'
    | 'extracting'
    | 'analyzing'
    | 'debating'
    | 'judging'
    | 'verifying'
    | 'revising'
    | 'strategy'
    | 'saving'
    | 'done';
  request_news_ids: string[];
  progress: {
    requested: number;
    processed: number;
    succeeded: number;
    failed: number;
  };
  result: {
    report_id: string | null;
    strategy_id: string | null;
    report_reused: boolean;
    strategy_reused: boolean;
  } | null;
  warnings: string[];
  error: ErrorDetail | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};
export type ApiReport = {
  schema_version: 2;
  report_id: string;
  title: string;
  event_summary: string;
  event_analysis: string;
  market_impact: string;
  stock_impacts: Array<{
    ticker: string | null;
    name: string;
    impact: string;
    direction: ImpactDirection;
    evidence_news_ids: string[];
    claim_ids?: string[] | null;
  }>;
  risk_factors: string[];
  requested_news_ids: string[];
  used_evidence: Array<{
    news_id: string;
    title: string;
    source_name: string;
    source_url: string;
    published_at: string | null;
    body_id: string;
    content_hash: string;
    input_char_count: number;
    truncated: boolean;
  }>;
  failed_evidence: Array<{
    news_id: string;
    code: string;
    message: string;
    retryable: boolean;
  }>;
  coverage: {
    requested_count: number;
    used_count: number;
    failed_count: number;
  };
  rag_evidence: Array<{
    news_id: string;
    title: string;
    source_url: string | null;
    description: string;
    description_hash: string;
  }>;
  verification: Verification;
  claims?: Claim[] | null;
  debate?: Debate[] | null;
  agent_trace?: AgentTrace[] | null;
  created_at: string;
};
export type ApiStrategy = {
  schema_version: 2;
  strategy_id: string;
  report_id: string;
  risk_level: 'low' | 'medium' | 'high';
  period: 'short' | 'mid' | 'long';
  strategy_summary: string;
  risk_warning: string;
  strategy_items: Array<{
    ticker: string | null;
    stock_name: string;
    action: 'buy' | 'hold' | 'sell' | 'watch';
    reason: string;
  }>;
  agent_trace?: AgentTrace[] | null;
  created_at: string;
};
export type V2Report = Omit<Report, 'stockImpacts' | 'strategySummary'> & {
  requestedNewsIds: string[];
  eventAnalysis: string;
  stockImpacts: ApiReport['stock_impacts'];
  strategySummary: Report['strategySummary'] | null;
  strategyItems: ApiStrategy['strategy_items'];
  evidence: ApiReport['used_evidence'];
  failedEvidence: ApiReport['failed_evidence'];
  ragEvidence: ApiReport['rag_evidence'];
  coverage: ApiReport['coverage'];
  verification: ApiReport['verification'];
  claims: Claim[];
  debate: Debate[];
  reportTrace: AgentTrace[];
  strategyTrace: AgentTrace[];
  warnings: string[];
};
export type NewsMapData = ApiMap & {
  session: Session;
  keyword: string;
  root: NewsCard | null;
  related: NewsCard[];
  reportTitle: string;
  reportLabel: string;
};
export type ActiveNewsMap = NewsMapData & { root: NewsCard };
export type MapUpdate = Partial<
  Pick<ApiMap, 'selected_news_ids' | 'detail_news_id' | 'report_panel_open'>
>;

const env =
  (
    import.meta as unknown as {
      env?: { VITE_API_BASE?: string; VITE_NEWS_MAP_SOURCE?: string };
    }
  ).env ?? {};
export const USE_MOCK = env.VITE_NEWS_MAP_SOURCE === 'mock';
const API_BASE = (env.VITE_API_BASE ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
);
const API = `${API_BASE}/api/v2`;
const REF_KEY = 'econmind.v2.navigation';
const AWAY_KEY = 'econmind.v2.away';
const BRANCH_KEY = 'econmind.v2.branch';
const KEYWORD_KEY = 'econmind.v2.keyword';
/** 펼치기 요청 뒤 이만큼 지나도 맵이 그대로면 결과를 더 기다리지 않는다. */
const BRANCH_WAIT_MS = 30_000;
export { ServiceError } from './serviceError';
import { ServiceError } from './serviceError';
function retryAfterSeconds(value: string | null): number | undefined {
  if (!value || !/^(0|[1-9]\d*)$/.test(value.trim())) return undefined;
  const seconds = Number(value.trim());
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}
export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  key?: string,
): Promise<T> {
  if (USE_MOCK)
    return mockV2Request(method, path, body, signal, key) as Promise<T>;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  const response = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = data?.error as ErrorDetail | undefined;
    throw new ServiceError(
      error?.message ?? `요청에 실패했습니다 (${response.status})`,
      response.status,
      error,
      response.status === 429
        ? retryAfterSeconds(response.headers.get('Retry-After'))
        : undefined,
    );
  }
  return data as T;
}
export function formatKst(value: string | null | undefined) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time)
    ? ''
    : new Date(time + 9 * 3600_000)
        .toISOString()
        .replace('T', ' ')
        .slice(0, 16);
}
export function cardFromApi(card: ApiCard, index = 0): NewsCard {
  const tones: NewsCard['thumbnailTone'][] = [
    'ai',
    'chip',
    'oil',
    'defense',
    'shipping',
    'currency',
  ];
  return {
    id: card.news_id,
    title: card.title,
    source: card.source_name,
    publishedAt: formatKst(card.published_at),
    summary: card.description,
    mockOriginalBody: '',
    sourceUrl: card.source_url ?? undefined,
    thumbnailTone: tones[index % tones.length],
    imageUrl: card.thumbnail_url ?? '',
    keywords: card.keywords,
    categories: card.categories,
    relatedStockSymbols: [],
    sentiment: 'neutral',
  };
}
export function mapFromApi(map: ApiMap, session: Session): NewsMapData {
  const root = map.nodes.find((n) => n.node_id === map.root_node_id);
  const branch = map.branches.find(
    (b) => b.parent_node_id === map.root_node_id,
  );
  const childIds =
    branch?.child_node_ids ??
    map.nodes
      .filter((n) => n.parent_node_id === map.root_node_id)
      .map((n) => n.node_id);
  return {
    ...map,
    session,
    keyword: map.query,
    root: root ? cardFromApi(root.news) : null,
    related: childIds
      .map((id) => map.nodes.find((n) => n.node_id === id))
      .filter((n): n is ApiNode => !!n)
      .map((n, i) => cardFromApi(n.news, i + 1)),
    reportTitle: '',
    reportLabel: '명시적 로컬 fixture',
  };
}
export function reportFromApi(
  report: ApiReport,
  strategy: ApiStrategy | null,
  warnings: string[] = [],
): V2Report {
  if (
    report.schema_version !== 2 ||
    (strategy && strategy.report_id !== report.report_id)
  )
    throw new ServiceError('리포트·전략 연결을 확인할 수 없습니다.');
  const stance = {
    low: '보수적 관점',
    medium: '중립적 관점',
    high: '적극적 관점',
  };
  return {
    id: report.report_id,
    clusterId: '',
    title: report.title,
    requestedNewsIds: report.requested_news_ids,
    eventSummary: report.event_summary,
    eventAnalysis: report.event_analysis,
    marketImpact: report.market_impact,
    stockImpacts: report.stock_impacts,
    riskFactors: report.risk_factors,
    strategySummary: strategy
      ? {
          stance: stance[strategy.risk_level],
          rationale: strategy.strategy_summary,
          watchlist: strategy.strategy_items.map((s) => s.stock_name),
          riskWarning: strategy.risk_warning,
        }
      : null,
    strategyItems: strategy?.strategy_items ?? [],
    evidence: report.used_evidence,
    failedEvidence: report.failed_evidence,
    ragEvidence: report.rag_evidence,
    coverage: report.coverage,
    verification: report.verification,
    claims: report.claims ?? [],
    debate: report.debate ?? [],
    reportTrace: report.agent_trace ?? [],
    strategyTrace: strategy?.agent_trace ?? [],
    warnings,
  };
}
export const fetchRecommendedKeywords = fetchMockRecommendedKeywords;
export async function fetchKeywordMap(
  query: string,
  signal?: AbortSignal,
): Promise<KeywordMapData> {
  const trimmed = query.trim();
  if (USE_MOCK) return fetchMockKeywordMap(trimmed);
  if (!trimmed) {
    throw new ServiceError('검색어를 입력해 주세요.', 422);
  }
  const response = await fetch(
    `${API_BASE}/api/v1/keywords/map?q=${encodeURIComponent(trimmed)}`,
    {
      method: 'GET',
      credentials: 'include',
      signal,
    },
  );
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : (data?.error?.message as string | undefined);
    throw new ServiceError(
      detail ?? `연관 키워드 조회에 실패했습니다 (${response.status})`,
      response.status,
      data?.error as ErrorDetail | undefined,
      response.status === 429
        ? retryAfterSeconds(response.headers.get('Retry-After'))
        : undefined,
    );
  }
  return data as KeywordMapData;
}
export function reportTitle(
  _map: unknown,
  evidence: NewsCard[],
  report: V2Report | null,
) {
  return (
    report?.title ??
    (evidence.length === 1
      ? `${evidence[0].title} — 영향 리포트`
      : `선택한 뉴스 ${evidence.length}건 리포트`)
  );
}
function storage() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
export function rememberMap(map: NewsMapData) {
  try {
    storage()?.setItem(
      REF_KEY,
      JSON.stringify({
        session_epoch: map.session.session_epoch,
        map_id: map.map_id,
      }),
    );
  } catch {
    /* Navigation remains usable when browser storage is disabled. */
  }
}
export function forgetMap() {
  try {
    storage()?.removeItem(REF_KEY);
  } catch {
    /* Browser storage is optional. */
  }
}
/** 뉴스맵 화면에 있는지 기억한다. 검색 화면으로 나간 뒤의 새로고침이 떠난 맵을 다시 열지 않게 한다. */
export function rememberMapOpen(open: boolean) {
  try {
    if (open) storage()?.removeItem(AWAY_KEY);
    else storage()?.setItem(AWAY_KEY, '1');
  } catch {
    /* Browser storage is optional. */
  }
}
export function mapWasOpen() {
  try {
    return storage()?.getItem(AWAY_KEY) == null;
  } catch {
    return true;
  }
}
/** 뉴스맵을 연 키워드 맵의 검색어. 새로고침 뒤 뒤로가기가 그 키워드 맵을 다시 불러오는 데 쓴다. */
export function rememberKeyword(query: string) {
  try {
    storage()?.setItem(KEYWORD_KEY, query);
  } catch {
    /* Browser storage is optional. */
  }
}
export function rememberedKeyword() {
  try {
    return storage()?.getItem(KEYWORD_KEY) ?? null;
  } catch {
    return null;
  }
}
type PendingBranch = {
  map_id: string;
  node_id: string;
  revision: number;
  started_at: number;
};
function rememberBranch(map: NewsMapData, nodeId: string) {
  try {
    const pending: PendingBranch = {
      map_id: map.map_id,
      node_id: nodeId,
      revision: map.revision,
      started_at: Date.now(),
    };
    storage()?.setItem(BRANCH_KEY, JSON.stringify(pending));
  } catch {
    /* Browser storage is optional. */
  }
}
function forgetBranch(mapId: string) {
  try {
    const pending = JSON.parse(storage()?.getItem(BRANCH_KEY) ?? 'null');
    if (pending?.map_id === mapId) storage()?.removeItem(BRANCH_KEY);
  } catch {
    /* Browser storage is optional. */
  }
}
/** 이 맵에 보냈지만 응답을 받지 못한 펼치기 요청. 서버가 이미 반영했거나 오래됐으면 지운다. */
function unansweredBranch(map: NewsMapData): PendingBranch | null {
  try {
    const pending = JSON.parse(
      storage()?.getItem(BRANCH_KEY) ?? 'null',
    ) as PendingBranch | null;
    if (pending?.map_id !== map.map_id) return null;
    if (
      pending.revision === map.revision &&
      Date.now() - pending.started_at < BRANCH_WAIT_MS &&
      map.nodes.some((node) => node.node_id === pending.node_id)
    )
      return pending;
    storage()?.removeItem(BRANCH_KEY);
  } catch {
    /* Browser storage is optional. */
  }
  return null;
}
function rememberExistingMap(map: NewsMapData) {
  try {
    const ref = JSON.parse(storage()?.getItem(REF_KEY) ?? 'null');
    if (ref?.map_id === map.map_id) rememberMap(map);
  } catch {
    /* Browser storage is optional. */
  }
}
export async function getSession(signal?: AbortSignal) {
  return request<Session>('GET', '/session', undefined, signal);
}
export async function fetchNewsMap(keyword: string) {
  const session = await getSession();
  const map = mapFromApi(
    await request<ApiMap>('POST', '/maps', { query: keyword.trim() }),
    session,
  );
  rememberMap(map);
  return map;
}
let restoring: Promise<NewsMapData | null> | null = null;
export function restoreNewsMap(): Promise<NewsMapData | null> {
  if (restoring) return restoring;
  restoring = (async () => {
    let ref: { session_epoch?: string; map_id?: string } | null = null;
    try {
      ref = JSON.parse(storage()?.getItem(REF_KEY) ?? 'null');
    } catch {
      forgetMap();
    }
    const session = await getSession();
    if (
      typeof ref?.map_id !== 'string' ||
      ref.session_epoch !== session.session_epoch
    ) {
      if (ref?.map_id) forgetExistingMap(ref.map_id);
      return null;
    }
    try {
      const map = mapFromApi(
        await request<ApiMap>('GET', `/maps/${encodeURIComponent(ref.map_id)}`),
        session,
      );
      rememberExistingMap(map);
      return map;
    } catch (error) {
      if (error instanceof ServiceError && [404, 410].includes(error.status)) {
        forgetExistingMap(ref.map_id);
        return null;
      }
      throw error;
    }
  })().finally(() => {
    restoring = null;
  });
  return restoring;
}
export async function fetchPreviousIssueMap(map: NewsMapData) {
  if (!map.previous_issue_map_id) throw new ServiceError('돌아갈 이전 뉴스맵이 없어요.');
  const previous = await request<ApiMap>('GET', `/maps/${encodeURIComponent(map.previous_issue_map_id)}`);
  return mapFromApi(previous, map.session);
}
export async function deleteMap(map: NewsMapData, includeIssues = false) {
  const query = includeIssues ? '?include_issues=true' : '';
  await request('DELETE', `/maps/${encodeURIComponent(map.map_id)}${query}`);
  forgetExistingMap(map.map_id);
}
function forgetExistingMap(mapId: string) {
  try {
    const ref = JSON.parse(storage()?.getItem(REF_KEY) ?? 'null');
    if (ref?.map_id === mapId) forgetMap();
  } catch {
    /* Browser storage is optional. */
  }
}
export async function deleteSession() {
  await request('DELETE', '/session');
  forgetMap();
}
export function selectionMessage(selection: Selection) {
  if (selection.status === 'partial')
    return `연관 기사 ${selection.returned}/${selection.requested}건 · 일시적인 조회 제한${selection.budget_exhausted ? ' · 이번 탐색 예산 종료' : ''}`;
  if (selection.shortage)
    return `연관 기사 ${selection.returned}/${selection.requested}건 · 선정 기준을 통과한 정보가 부족해요${selection.budget_exhausted ? ' · 이번 탐색 예산 종료' : ''}`;
  return `연관 기사 ${selection.returned}/${selection.requested}건`;
}
export function phaseOf(stage: ReportJob['stage']): ReportPhase {
  return stage === 'done'
    ? 3
    : ['strategy', 'saving'].includes(stage)
      ? 2
      : ['analyzing', 'debating', 'judging', 'verifying', 'revising'].includes(stage)
        ? 1
        : 0;
}
export const STAGE_LABEL: Record<ReportJob['stage'], string> = {
  queued: '작업 대기',
  extracting: '본문 추출',
  analyzing: '사건·시장 영향 분석',
  debating: '강세·약세 분석',
  judging: '중재 판정',
  verifying: '근거 검증',
  revising: '주장 수정·재검증',
  strategy: '전략 생성',
  saving: '결과 저장',
  done: '작업 종료',
};
const terminal = (job: ReportJob) =>
  ['completed', 'failed', 'cancelled'].includes(job.status);
export type ControllerState = {
  map: NewsMapData;
  job: ReportJob | null;
  report: V2Report | null;
  error: string | null;
  expired: boolean;
  /** 응답을 받지 못한 펼치기 요청의 부모 노드 ID. 결과가 맵에 반영되기를 기다리는 동안만 있다. */
  branching: string | null;
};
/** Revision changes are serialized. Poll responses can update only their active job and evidence set. */
export class NewsMapController {
  state: ControllerState;
  private listeners = new Set<(state: ControllerState) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private pollAbort: AbortController | null = null;
  private viewOpen = false;
  private requestToken = 0;
  private pending: {
    key: string;
    body: {
      map_id: string;
      expected_revision: number;
      client_request_id: string;
      news_ids: string[];
      language: string;
      report_type: string;
      strategy_options: { risk_level: string; period: string };
    };
  } | null = null;
  private branchDeadline = 0;
  constructor(map: NewsMapData) {
    const pending = unansweredBranch(map);
    if (pending) this.branchDeadline = pending.started_at + BRANCH_WAIT_MS;
    this.state = {
      map,
      job: null,
      report: null,
      error: null,
      expired: false,
      branching: pending?.node_id ?? null,
    };
  }
  subscribe(listener: (state: ControllerState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(patch: Partial<ControllerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  private accept(map: ApiMap) {
    if (map.revision < this.state.map.revision) return this.state.map;
    const next = mapFromApi(map, this.state.map.session);
    rememberExistingMap(next);
    this.emit({ map: next });
    return next;
  }
  private handle(error: unknown) {
    if (error instanceof ServiceError && error.status === 410) {
      forgetExistingMap(this.state.map.map_id);
      this.emit({
        expired: true,
        error: '탐색 세션이 만료됐어요. 새 검색을 시작하세요.',
      });
    } else
      this.emit({
        error: error instanceof Error ? error.message : '요청에 실패했어요.',
      });
  }
  private serialize<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      this.emit({ error: null });
      try {
        return await action();
      } catch (error) {
        if (error instanceof ServiceError && error.status === 409)
          await this.refresh();
        this.handle(error);
        throw error;
      }
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
  async refresh(signal?: AbortSignal) {
    return this.accept(
      await request<ApiMap>(
        'GET',
        `/maps/${encodeURIComponent(this.state.map.map_id)}`,
        undefined,
        signal,
      ),
    );
  }
  openNextIssue() {
    return this.serialize(async () => {
      const map = this.state.map;
      const next = await request<ApiMap>(
        'POST',
        `/maps/${encodeURIComponent(map.map_id)}/next-issue`,
      );
      return next.map_id === map.map_id
        ? this.accept(next)
        : mapFromApi(next, map.session);
    });
  }
  update(fields: MapUpdate) {
    return this.serialize(async () => {
      const map = this.state.map;
      const changed =
        fields.selected_news_ids !== undefined &&
        !sameIds(fields.selected_news_ids, map.selected_news_ids);
      if (changed) {
        this.stopPolling();
        this.emit({ job: null, report: null });
      }
      const next = this.accept(
        await request<ApiMap>(
          'PATCH',
          `/maps/${encodeURIComponent(map.map_id)}`,
          { expected_revision: map.revision, ...fields },
        ),
      );
      if (changed && next.report_panel_open && next.selected_news_ids.length)
        await this.startInternal(next.selected_news_ids);
      return next;
    });
  }
  select(newsId: string) {
    return this.serialize(async () => {
      const map = this.state.map;
      const selected = map.selected_news_ids;
      const limit = map.session.capabilities.max_report_articles;
      const ids = selected.includes(newsId)
        ? selected.filter((id) => id !== newsId)
        : limit === 1
          ? [newsId]
          : [...selected, newsId];
      if (ids.length > limit)
        throw new ServiceError(
          `리포트 근거는 최대 ${limit}건까지 고를 수 있어요.`,
        );
      this.stopPolling();
      this.emit({ report: null, job: null });
      const next = this.accept(
        await request<ApiMap>(
          'PATCH',
          `/maps/${encodeURIComponent(map.map_id)}`,
          { expected_revision: map.revision, selected_news_ids: ids },
        ),
      );
      if (next.report_panel_open && ids.length) await this.startInternal(ids);
      return next;
    });
  }
  branch(nodeId: string, mode: 'expand' | 'research') {
    return this.serialize(async () => {
      const before = this.state.map;
      rememberBranch(before, nodeId);
      let next: NewsMapData;
      try {
        next = this.accept(
          await request<ApiMap>(
            'POST',
            `/maps/${encodeURIComponent(before.map_id)}/branches`,
            { expected_revision: before.revision, parent_node_id: nodeId, mode },
          ),
        );
      } catch (error) {
        // 서버가 거절했으면 기다릴 결과가 없다. 응답을 못 받았으면 서버가 계속 처리할 수 있어 남겨 둔다.
        if (error instanceof ServiceError) forgetBranch(before.map_id);
        throw error;
      }
      forgetBranch(before.map_id);
      await this.afterBranch(before, next);
      return next;
    });
  }
  private async afterBranch(before: NewsMapData, next: NewsMapData) {
    if (sameIds(before.selected_news_ids, next.selected_news_ids)) return;
    this.stopPolling();
    this.emit({ job: null, report: null });
    if (next.report_panel_open && next.selected_news_ids.length)
      await this.startInternal(next.selected_news_ids);
  }
  /**
   * 새로고침 전에 보낸 펼치기 요청의 응답은 받을 수 없다. 서버 맵의 revision이 오를 때까지 GET으로
   * 기다리고, 응답을 기다리던 때처럼 이후 조작은 그 뒤에 보낸다. 돌려준 함수는 기다림을 멈춘다.
   */
  resumeBranch() {
    const abort = new AbortController();
    if (this.state.branching)
      this.queue = this.queue.then(() => this.awaitBranch(abort.signal));
    return () => abort.abort();
  }
  private async awaitBranch(signal: AbortSignal) {
    if (signal.aborted || !this.state.branching) return;
    const before = this.state.map;
    try {
      for (;;) {
        const map = await request<ApiMap>(
          'GET',
          `/maps/${encodeURIComponent(before.map_id)}`,
          undefined,
          signal,
        );
        if (map.revision > before.revision) {
          await this.afterBranch(before, this.accept(map));
          break;
        }
        if (Date.now() >= this.branchDeadline)
          throw new ServiceError(
            '하위 뉴스 검색 결과를 확인하지 못했어요. 다시 시도해 주세요.',
          );
        await wait(1000, signal);
      }
    } catch (error) {
      if (signal.aborted) return;
      this.handle(error);
    }
    forgetBranch(before.map_id);
    this.emit({ branching: null });
  }
  reset() {
    return this.serialize(async () => {
      this.stopPolling();
      const map = this.state.map;
      const next = this.accept(
        await request<ApiMap>(
          'POST',
          `/maps/${encodeURIComponent(map.map_id)}/reset`,
          { expected_revision: map.revision },
        ),
      );
      this.emit({ job: null, report: null });
      return next;
    });
  }
  openReport(fromNewsId?: string) {
    return this.serialize(async () => {
      const map = this.state.map;
      const ids = map.selected_news_ids.length
        ? map.selected_news_ids
        : fromNewsId
          ? [fromNewsId]
          : [];
      if (!ids.length)
        throw new ServiceError('먼저 리포트에 쓸 카드를 선택하세요.');
      this.viewOpen = true;
      if (this.pending && sameIds(this.pending.body.news_ids, ids)) {
        await this.startInternal(ids);
        return;
      }
      if (
        map.report_panel_open &&
        map.active_report_job_id &&
        sameIds(ids, map.selected_news_ids)
      ) {
        this.observe();
        return;
      }
      if (map.active_report_job_id && sameIds(ids, map.selected_news_ids)) {
        this.accept(
          await request<ApiMap>(
            'PATCH',
            `/maps/${encodeURIComponent(map.map_id)}`,
            {
              expected_revision: map.revision,
              report_panel_open: true,
              detail_news_id: null,
            },
          ),
        );
        this.observe();
        return;
      }
      if (map.last_result && sameIds(ids, map.selected_news_ids)) {
        this.accept(
          await request<ApiMap>(
            'PATCH',
            `/maps/${encodeURIComponent(map.map_id)}`,
            {
              expected_revision: map.revision,
              report_panel_open: true,
              detail_news_id: null,
            },
          ),
        );
        const loaded = await this.loadResult(
          map.last_result,
          this.requestToken,
        );
        if (loaded) return;
        await this.startInternal(ids);
        return;
      }
      if (!map.report_panel_open || !sameIds(ids, map.selected_news_ids))
        this.accept(
          await request<ApiMap>(
            'PATCH',
            `/maps/${encodeURIComponent(map.map_id)}`,
            {
              expected_revision: map.revision,
              selected_news_ids: ids,
              report_panel_open: true,
              detail_news_id: null,
            },
          ),
        );
      await this.startInternal(ids);
    });
  }
  retryReport() {
    return this.serialize(() =>
      this.startInternal(this.state.map.selected_news_ids),
    );
  }
  private async startInternal(ids: string[]) {
    if (!ids.length) return;
    this.stopPolling();
    this.emit({ report: null, job: null });
    const map = this.state.map;
    const pending =
      this.pending &&
      this.pending.body.map_id === map.map_id &&
      this.pending.body.expected_revision === map.revision &&
      sameIds(this.pending.body.news_ids, ids)
        ? this.pending
        : {
            key: crypto.randomUUID(),
            body: {
              map_id: map.map_id,
              expected_revision: map.revision,
              client_request_id: crypto.randomUUID(),
              news_ids: [...new Set(ids)],
              language: 'ko',
              report_type: 'investment',
              strategy_options: { risk_level: 'medium', period: 'short' },
            },
          };
    this.pending = pending;
    const { body, key: id } = pending;
    let job: ReportJob;
    try {
      job = await request<ReportJob>(
        'POST',
        '/report-jobs',
        body,
        undefined,
        id,
      );
    } catch (error) {
      // A transport retry uses identical input/key; dependency errors remain explicit.
      if (error instanceof TypeError)
        job = await request<ReportJob>(
          'POST',
          '/report-jobs',
          body,
          undefined,
          id,
        );
      else {
        if (
          !(
            error instanceof ServiceError &&
            (error.detail?.retryable || error.status === 503)
          )
        )
          this.pending = null;
        throw error;
      }
    }
    this.pending = null;
    this.accept({
      ...map,
      revision: job.accepted_map_revision,
      selected_news_ids: body.news_ids,
      report_panel_open: true,
      detail_news_id: null,
      active_report_job_id: job.job_id,
    });
    this.emit({ job });
    if (this.viewOpen) this.observe();
  }
  setVisible(visible: boolean) {
    this.viewOpen = visible;
    if (!visible) {
      this.stopPolling();
    } else if (
      !this.state.map.report_panel_open &&
      !this.state.map.active_report_job_id &&
      this.state.map.last_result &&
      !this.state.report
    ) {
      // Restore node evidence badges with GETs even if the report panel is closed.
      this.stopPolling();
      const token = this.requestToken;
      const abort = new AbortController();
      this.pollAbort = abort;
      void this.loadResult(this.state.map.last_result, token, abort.signal).catch(
        (error) => {
          if (!abort.signal.aborted && token === this.requestToken)
            this.handle(error);
        },
      );
    } else this.observe();
  }
  stopPolling() {
    ++this.requestToken;
    this.pollAbort?.abort();
    this.pollAbort = null;
  }
  private observe() {
    this.stopPolling();
    if (!this.viewOpen || !this.state.map.report_panel_open) return;
    const token = this.requestToken;
    const abort = new AbortController();
    this.pollAbort = abort;
    void this.poll(token, abort.signal).catch((error) => {
      if (!abort.signal.aborted && token === this.requestToken)
        this.handle(error);
    });
  }
  private async poll(token: number, signal: AbortSignal) {
    const id = this.state.map.active_report_job_id;
    if (!id) {
      if (this.state.map.last_result)
        await this.loadResult(this.state.map.last_result, token, signal);
      return;
    }
    for (;;) {
      let job: ReportJob;
      try {
        job = await request<ReportJob>(
          'GET',
          `/report-jobs/${encodeURIComponent(id)}`,
          undefined,
          signal,
        );
      } catch (error) {
        if (
          error instanceof ServiceError &&
          [404, 410].includes(error.status)
        ) {
          const map = await this.refresh(signal);
          if (token === this.requestToken && map.last_result)
            await this.loadResult(map.last_result, token, signal);
          else if (token === this.requestToken) this.handle(error);
          return;
        }
        throw error;
      }
      if (
        signal.aborted ||
        token !== this.requestToken ||
        this.state.map.active_report_job_id !== id ||
        !sameIds(job.request_news_ids, this.state.map.selected_news_ids)
      )
        return;
      this.emit({ job });
      if (terminal(job)) {
        const map = await this.refresh(signal);
        if (
          signal.aborted ||
          token !== this.requestToken ||
          !sameIds(job.request_news_ids, map.selected_news_ids)
        )
          return;
        if (
          job.status === 'completed' &&
          job.result?.report_id &&
          map.last_result?.report_id === job.result.report_id &&
          (!map.active_report_job_id || map.active_report_job_id === id)
        )
          await this.loadResult(
            {
              report_id: job.result.report_id,
              strategy_id: job.result.strategy_id,
            },
            token,
            signal,
            job.warnings,
          );
        else if (job.status === 'failed')
          this.emit({
            error: job.error?.message ?? '리포트 생성에 실패했어요.',
          });
        return;
      }
      await wait(1000, signal);
    }
  }
  private async loadResult(
    result: { report_id: string; strategy_id: string | null },
    token: number,
    signal?: AbortSignal,
    warnings: string[] = [],
  ) {
    const report = await request<ApiReport>(
      'GET',
      `/reports/${encodeURIComponent(result.report_id)}`,
      undefined,
      signal,
    );
    let strategy: ApiStrategy | null = null;
    if (result.strategy_id) {
      try {
        strategy = await request<ApiStrategy>(
          'GET',
          `/strategies/${encodeURIComponent(result.strategy_id)}`,
          undefined,
          signal,
        );
      } catch (error) {
        if (signal?.aborted) throw error;
        warnings = [...warnings, 'STRATEGY_LOAD_FAILED'];
      }
    }
    if (
      signal?.aborted ||
      token !== this.requestToken ||
      !sameIds(report.requested_news_ids, this.state.map.selected_news_ids) ||
      this.state.map.last_result?.report_id !== result.report_id
    )
      return false;
    this.emit({ report: reportFromApi(report, strategy, warnings) });
    return true;
  }
  cancel() {
    return this.serialize(async () => {
      const id = this.state.map.active_report_job_id;
      if (!id) return;
      const job = await request<ReportJob>(
        'POST',
        `/report-jobs/${encodeURIComponent(id)}/cancel`,
      );
      this.emit({ job });
      if (this.viewOpen) this.observe();
    });
  }
}
export function sameIds(a: string[], b: string[]) {
  return (
    a.length === b.length &&
    [...a].sort().join('\n') === [...b].sort().join('\n')
  );
}
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException('Aborted', 'AbortError'));
    const done = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
