/**
 * API adapter for the 9주차 API specification.
 *
 * The UI still renders with the local prototype data shape, while this file
 * translates /api/v1 responses into IssueCluster / NewsCard / Report objects.
 */

import {
  clusters as staticClusters,
  newsCards as staticNewsCards,
  reports as staticReports,
  type IssueCluster,
  type NewsCard,
  type NewsMapSelection,
  type Report,
} from './mockData';

export const dynClusters = new Map<string, IssueCluster>();
export const dynNews = new Map<string, NewsCard>();
export const dynReports = new Map<string, Report>();

const BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');
const API_V1 = `${BASE}/api/v1`;

const TONES: NewsCard['thumbnailTone'][] = [
  'ai',
  'chip',
  'oil',
  'defense',
  'shipping',
  'currency',
];

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1516937941344-00b4e0337589?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1517976547714-720226b864c1?auto=format&fit=crop&w=520&q=80',
];

type ApiNewsCard = {
  description?: string;
  news_id: string;
  title: string;
  summary: string;
  thumbnail_url: string;
  source_name?: string;
  published_at?: string;
  related_stock_names?: string[];
  source_url?: string;
  keywords?: string[];
  categories?: string[];
};

type ApiSearchResponse = {
  news_cards: ApiNewsCard[];
  total_count: number;
};

type ApiRecommendedKeywordsResponse = {
  keywords: Array<{
    keyword: string;
    category: string;
    rank: number;
  }>;
};

type ApiSourceResponse = {
  news_id: string;
  source_name: string;
  source_url: string;
  published_at: string;
  original_title: string;
  original_body?: string;
  description?: string;
  thumbnail_url?: string;
  keywords?: string[];
  categories?: string[];
};

type ApiRelatedNewsItem = ApiNewsCard & {
  relevance_score?: number | null;
  distance: number;
  same_story?: ApiNewsCard[];
  same_story_total?: number;
};

type ApiRelatedResponse = {
  related_news: ApiRelatedNewsItem[];
  center_same_story?: ApiNewsCard[];
  center_same_story_total?: number;
  selection?: NewsMapSelection | null;
};

type ApiReportCreateResponse = {
  report_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
};

type ApiReportResponse = {
  report_id: string;
  title: string;
  summary: string;
  event_analysis: string;
  market_impact: string;
  related_stocks: string[];
  evidence_news: Array<Record<string, unknown>>;
  risk_factors: string[];
  created_at: string;
};

type ApiStrategyCreateResponse = {
  strategy_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
};

type ApiStrategyResponse = {
  strategy_id: string;
  expected_return: number;
  risk: string;
  period: string;
  strategy_summary: string;
  strategy_items: Array<{
    ticker: string;
    stock_name: string;
    action: 'buy' | 'hold' | 'sell' | 'watch';
    reason: string;
  }>;
  created_at: string;
};

let recommendedKeywordCache: string[] | null = null;

export function resolveCluster(id: string): IssueCluster {
  return dynClusters.get(id) ?? staticClusters.find((c) => c.id === id) ?? staticClusters[0];
}

export function resolveNews(id: string): NewsCard {
  return dynNews.get(id) ?? staticNewsCards.find((n) => n.id === id) ?? staticNewsCards[0];
}

export function resolveReport(id: string): Report {
  return dynReports.get(id) ?? staticReports.find((r) => r.id === id) ?? staticReports[0];
}

export function findOrResolveClusterByQuery(term: string): IssueCluster {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return staticClusters[0];

  for (const c of dynClusters.values()) {
    if (
      c.query.toLowerCase().includes(normalized) ||
      c.recommendedKeywords.some((k) => k.toLowerCase().includes(normalized))
    ) {
      return c;
    }
  }

  return (
    staticClusters.find((c) => {
      return (
        c.query.toLowerCase().includes(normalized) ||
        c.recommendedKeywords.some((k) => k.toLowerCase().includes(normalized))
      );
    }) ?? staticClusters[0]
  );
}

export async function fetchRecommendedKeywordLabels(limit = 8): Promise<string[]> {
  if (recommendedKeywordCache) return recommendedKeywordCache.slice(0, limit);

  const params = new URLSearchParams({ limit: String(limit) });
  const data = await apiGet<ApiRecommendedKeywordsResponse>(`/keywords/recommended?${params}`);
  recommendedKeywordCache = data.keywords.map((item) => item.keyword);
  return recommendedKeywordCache;
}

export async function fetchAndCacheCluster(term: string): Promise<IssueCluster> {
  const trimmed = term.trim();
  if (!trimmed) return staticClusters[0];

  const clusterId = `keyword-${slugify(trimmed)}`;

  if (dynClusters.has(clusterId)) {
    return dynClusters.get(clusterId)!;
  }

  // 추천 키워드 호출 실패를 여기서 삼키면 안 된다.
  // 예전에는 .catch(() => [])로 흡수해 "검색어 1개"짜리 클러스터를 정상 반환했고,
  // 호출부의 try/catch가 발동하지 않아 백엔드가 없을 때 키워드 맵에
  // 중심 노드 하나만 그려졌다. 실패는 호출부로 넘겨 폴백을 타게 한다.
  const recommendedKeywords = await fetchRecommendedKeywordLabels(10);
  const keywords = unique([trimmed, ...recommendedKeywords]);

  if (keywords.length <= 1) {
    throw new Error('추천 키워드가 비어 있어 키워드 맵을 만들 수 없습니다.');
  }

  const cluster: IssueCluster = {
    id: clusterId,
    query: trimmed,
    mainNewsId: '',
    relatedNewsIds: [],
    recommendedKeywords: keywords,
    reportId: `${clusterId}-report-placeholder`,
  };

  dynClusters.set(clusterId, cluster);
  return cluster;
}

/**
 * API가 실패했을 때 쓰는 로컬 대체 클러스터.
 *
 * `findOrResolveClusterByQuery`를 그대로 쓰면 매칭되지 않는 검색어는
 * staticClusters[0]("중동 전황")이 되어 중심 노드가 사용자의 검색어와
 * 무관해진다. 검색어는 중심에 남기고 키워드만 로컬 데이터로 채운다.
 */
export function buildFallbackCluster(term: string): IssueCluster {
  const trimmed = term.trim();
  if (!trimmed) return staticClusters[0];

  const base = findOrResolveClusterByQuery(trimmed);
  const clusterId = `fallback-${slugify(trimmed)}`;
  const cluster: IssueCluster = {
    ...base,
    id: clusterId,
    query: trimmed,
    recommendedKeywords: unique([trimmed, ...base.recommendedKeywords]),
  };

  dynClusters.set(clusterId, cluster);
  return cluster;
}

export async function fetchAndCacheNewsCluster(term: string): Promise<IssueCluster> {
  const trimmed = term.trim();
  if (!trimmed) return staticClusters[0];

  const clusterId = `api-v1-${slugify(trimmed)}`;

  const params = new URLSearchParams({
    q: trimmed,
    page: '1',
    size: '20',
    sort: 'relevance',
  });
  const [searchData, recommendedKeywords] = await Promise.all([
    apiGet<ApiSearchResponse>(`/news/search?${params}`),
    fetchRecommendedKeywordLabels(10).catch(() => []),
  ]);

  return cacheSearchAsCluster({
    clusterId,
    query: trimmed,
    cards: searchData.news_cards,
    recommendedKeywords,
  });
}

/**
 * /related가 선정한 순서와 FREE 상한을 그대로 유지한다.
 * 검색 후보·다른 API로 부족한 수를 보충하지 않는다. 새 중심을 평가하는 동안과
 * 실패 시에는 이전 중심의 연관 목록을 비운다. 같은 중심의 확장 요청(keep)은
 * 응답이 올 때까지 이미 받은 결과를 유지한다. 늦게 도착한 이전 요청은 버린다.
 */
const newsMapRequests = new Map<string, number>();

export type NewsMapOptions = {
  /** false면 서버가 최초 후보만 평가하고, 더 찾을 수 있으면 status=expandable을 준다. */
  expand?: boolean;
  /** 같은 중심의 결과를 확장하는 요청이면 기존 결과를 지우지 않는다. */
  keep?: boolean;
};

export async function fetchAndCacheNewsMap(
  newsId: string,
  currentClusterId: string,
  limit = 6,
  { expand = true, keep = false }: NewsMapOptions = {},
): Promise<IssueCluster> {
  const currentCluster = resolveCluster(currentClusterId);
  const request = (newsMapRequests.get(currentClusterId) ?? 0) + 1;
  newsMapRequests.set(currentClusterId, request);
  if (!keep || currentCluster.mainNewsId !== newsId) {
    dynClusters.set(currentClusterId, {
      ...currentCluster, mainNewsId: newsId, relatedNewsIds: [],
      sameStory: {}, sameStoryTotals: {}, mapSelection: undefined,
    });
  }
  const params = new URLSearchParams({ limit: String(limit), tier: 'FREE', expand: String(expand) });
  const relatedData = await apiGet<ApiRelatedResponse>(
    `/news/${encodeURIComponent(newsId)}/related?${params}`,
  );
  if (newsMapRequests.get(currentClusterId) !== request) return resolveCluster(currentClusterId);

  const relatedIds: string[] = [];
  const sameStory: Record<string, string[]> = {};
  const sameStoryTotals: Record<string, number> = {};
  const cacheStory = (ownerId: string, cards: ApiNewsCard[] | undefined, total: number | undefined) => {
    const ids = (cards ?? []).map((card, index) => {
      const news = apiCardToNewsCard(card, currentCluster.query, index + 1);
      dynNews.set(news.id, news);
      return news.id;
    });
    if (ids.length > 0) {
      sameStory[ownerId] = ids;
      sameStoryTotals[ownerId] = Math.max(total ?? ids.length, ids.length);
    }
  };

  relatedData.related_news
    .slice(0, limit)
    .forEach((item, index) => {
      const card = apiCardToNewsCard(item, currentCluster.query, index + 1);
      dynNews.set(card.id, card);
      relatedIds.push(card.id);
      cacheStory(card.id, item.same_story, item.same_story_total);
    });
  cacheStory(newsId, relatedData.center_same_story, relatedData.center_same_story_total);

  const nextCluster: IssueCluster = {
    ...resolveCluster(currentClusterId),
    id: currentClusterId,
    mainNewsId: newsId,
    relatedNewsIds: relatedIds,
    sameStory,
    sameStoryTotals,
    mapSelection: relatedData.selection ?? undefined,
  };
  dynClusters.set(currentClusterId, nextCluster);
  return nextCluster;
}

/**
 * 확장 요청이 실패하면 이미 표시한 최초 결과를 유지하되, 화면 상태를
 * '부분 결과'로 맞춘다. 같은 중심의 최신 요청이 아니면 아무것도 바꾸지 않는다.
 */
export function markNewsMapPartial(newsId: string, clusterId: string, reason: string): IssueCluster {
  const cluster = resolveCluster(clusterId);
  if (cluster.mainNewsId !== newsId || cluster.mapSelection?.status !== 'expandable') return cluster;
  const next: IssueCluster = { ...cluster, mapSelection: { ...cluster.mapSelection, status: 'partial', reason } };
  dynClusters.set(clusterId, next);
  return next;
}

export async function fetchAndCacheNewsSource(newsId: string): Promise<NewsCard> {
  const source = await apiGet<ApiSourceResponse>(`/news/${encodeURIComponent(newsId)}/source`);
  const existing = findKnownNews(newsId);
  const updated = apiCardToNewsCard({
    news_id: newsId,
    title: source.original_title,
    description: source.description,
    summary: existing?.summary ?? '',
    source_name: source.source_name,
    published_at: source.published_at,
    source_url: source.source_url,
    thumbnail_url: source.thumbnail_url ?? '',
    keywords: source.keywords,
    categories: source.categories,
  }, '', 0);
  updated.mockOriginalBody = source.original_body ?? existing?.mockOriginalBody ?? '';
  dynNews.set(newsId, updated);
  return updated;
}

export async function createAndCacheReport(
  clusterId: string,
  newsId: string,
  relatedNewsIds: string[],
): Promise<Report> {
  try {
    const centerNews = resolveNews(newsId);
    const created = await apiPost<ApiReportCreateResponse>('/reports', {
      news_id: newsId,
      related_news_ids: relatedNewsIds,
      ticker_symbols: centerNews.relatedStockSymbols,
      language: 'ko',
      report_type: 'investment',
    });

    const apiReport = await apiGet<ApiReportResponse>(
      `/reports/${encodeURIComponent(created.report_id)}`,
    );
    const strategy = await createAndFetchStrategy(created.report_id).catch(() => null);

    if (!strategy || hasBackendFallbackText(apiReport, strategy)) {
      throw new Error('AI report or strategy generation is unavailable');
    }

    const report = mapApiReport(apiReport, clusterId, strategy);
    cacheReportForCluster(clusterId, report);
    return report;
  } catch (error) {
    throw error;
  }
}

async function createAndFetchStrategy(reportId: string): Promise<ApiStrategyResponse> {
  const created = await apiPost<ApiStrategyCreateResponse>('/strategies', {
    report_id: reportId,
    risk_level: 'medium',
    period: 'short',
    strategy_type: 'simulation',
  });

  return apiGet<ApiStrategyResponse>(`/strategies/${encodeURIComponent(created.strategy_id)}`);
}

function cacheSearchAsCluster({
  clusterId,
  query,
  cards,
  recommendedKeywords,
}: {
  clusterId: string;
  query: string;
  cards: ApiNewsCard[];
  recommendedKeywords: string[];
}): IssueCluster {
  const newsIds = cards.map((card, index) => {
    const newsCard = apiCardToNewsCard(card, query, index);
    dynNews.set(newsCard.id, newsCard);
    return newsCard.id;
  });

  const keywords = unique([
    query,
    ...recommendedKeywords,
    ...cards.flatMap((card) => card.related_stock_names ?? []),
  ]).slice(0, 11);

  const cluster: IssueCluster = {
    id: clusterId,
    query,
    mainNewsId: newsIds[0] ?? '',
    relatedNewsIds: [],
    recommendedKeywords: keywords.length > 0 ? keywords : staticClusters[0].recommendedKeywords,
    reportId: `${clusterId}-report-placeholder`,
  };

  dynClusters.set(clusterId, cluster);
  return cluster;
}

const RISK_LABEL: Record<string, string> = { low: '보수적', medium: '중립적', high: '공격적' };
const PERIOD_LABEL: Record<string, string> = { short: '단기', mid: '중기', long: '장기' };

/**
 * 매매 의견 → 카드 색상. 상승=빨강, 하락=파랑인 한국 증시 관례를 따른다
 * (design/tokens.css 의 --up / --down).
 */
const ACTION_META: Record<string, { label: string; direction: 'up' | 'down' | 'mixed' }> = {
  buy: { label: '매수', direction: 'up' },
  sell: { label: '매도', direction: 'down' },
  hold: { label: '보유', direction: 'mixed' },
  watch: { label: '관망', direction: 'mixed' },
};

function label(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

/**
 * 종목 카드는 전략 응답의 strategy_items 로 만든다.
 *
 * 이전 구현은 related_stocks(문자열 배열)만 보고 카드를 만들면서
 * 모든 카드에 같은 market_impact 를 복사해 넣고 symbol 과 name 에 같은 값을 넣었다.
 * 종목이 3개면 같은 문장이 3번 반복됐고 direction 도 늘 'mixed' 라 등락 색상이
 * 아무 의미가 없었다. 정작 strategy_items 에는 ticker · stock_name · action · reason 이
 * 다 들어 있는데 watchlist 에 쓸 이름만 뽑고 나머지를 버리고 있었다.
 */
function buildStockImpacts(
  apiReport: ApiReportResponse,
  strategy: ApiStrategyResponse | null,
): Report['stockImpacts'] {
  if (strategy && strategy.strategy_items.length > 0) {
    return strategy.strategy_items.map((item) => {
      const meta = ACTION_META[item.action] ?? ACTION_META.watch;
      const name = item.stock_name || item.ticker;
      return {
        // 백엔드가 티커 없이 종목명만 줄 때가 있다. 같은 값을 두 번 쓰지 않는다.
        symbol: item.ticker && item.ticker !== name ? item.ticker : '',
        name,
        impact: item.reason,
        direction: meta.direction,
        actionLabel: meta.label,
      };
    });
  }

  // 전략이 없으면 종목명만 나열한다. 같은 문장을 카드마다 반복하지 않는다.
  return apiReport.related_stocks.map((stock) => ({
    symbol: '',
    name: stock,
    impact: '',
    direction: 'mixed' as const,
  }));
}

function mapApiReport(
  apiReport: ApiReportResponse,
  clusterId: string,
  strategy: ApiStrategyResponse | null,
): Report {
  return {
    id: apiReport.report_id,
    clusterId,
    title: apiReport.title,
    eventSummary: apiReport.summary || apiReport.event_analysis,
    marketImpact: apiReport.market_impact,
    stockImpacts: buildStockImpacts(apiReport, strategy),
    riskFactors: apiReport.risk_factors,
    strategySummary: strategy
      ? {
          // 예전에는 `전략 ${strategy.risk}` 라서 화면에 "전략 medium" 으로 찍혔다
          stance: `${label(PERIOD_LABEL, strategy.period)} · ${label(RISK_LABEL, strategy.risk)} 전략`,
          rationale: strategy.strategy_summary,
          watchlist: strategy.strategy_items.map((item) => item.stock_name || item.ticker),
          riskWarning: `예상 수익률 ${strategy.expected_return}% · ${label(PERIOD_LABEL, strategy.period)} 기준`,
        }
      : {
          stance: '전략 생성 대기',
          rationale: apiReport.summary,
          watchlist: apiReport.related_stocks,
          riskWarning: apiReport.risk_factors[0] ?? '추가 리스크 검토가 필요합니다.',
        },
  };
}

function cacheReportForCluster(clusterId: string, report: Report) {
  dynReports.set(report.id, report);

  const cluster = resolveCluster(clusterId);
  dynClusters.set(clusterId, { ...cluster, reportId: report.id });
}

function hasBackendFallbackText(
  apiReport: ApiReportResponse,
  strategy: ApiStrategyResponse | null,
): boolean {
  const values = [
    apiReport.summary,
    apiReport.event_analysis,
    apiReport.market_impact,
    ...apiReport.risk_factors,
    strategy?.strategy_summary,
  ];

  return values.some((value) => {
    if (!value) return false;
    return (
      value.includes('AI 분석 준비 중') ||
      value.includes('생성하지 못했습니다') ||
      value.includes('기본 포트폴리오 전략')
    );
  });
}

function apiCardToNewsCard(card: ApiNewsCard, query: string, index: number): NewsCard {
  const existing = findKnownNews(card.news_id);
  const stocks = card.related_stock_names ?? existing?.relatedStockSymbols ?? [];
  return {
    id: card.news_id,
    title: card.title,
    source: card.source_name ?? existing?.source ?? '',
    publishedAt: card.published_at !== undefined ? formatDate(card.published_at) : existing?.publishedAt ?? '',
    summary: card.description || card.summary,
    mockOriginalBody: existing?.mockOriginalBody ?? '',
    sourceUrl: card.source_url ?? existing?.sourceUrl,
    thumbnailTone: existing?.thumbnailTone ?? pickTone(card.title, index),
    imageUrl: card.thumbnail_url || existing?.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    // Missing fields support older servers; explicit empty arrays clear stale tags.
    keywords: card.keywords ?? existing?.keywords ?? unique([query, ...stocks]).filter(Boolean).slice(0, 4),
    categories: card.categories ?? existing?.categories ?? [],
    relatedStockSymbols: stocks,
    sentiment: existing?.sentiment ?? 'neutral',
  };
}

/**
 * resolveNews 와 달리 모르는 id 에 staticNewsCards[0] 을 돌려주지 않는다.
 * "조용히 엉뚱한 뉴스"를 만들면 안 되는 자리에서 쓴다.
 */
export function findKnownNews(id: string): NewsCard | undefined {
  return dynNews.get(id) ?? staticNewsCards.find((news) => news.id === id);
}

// 로그인이 없으므로 백엔드가 발급하는 세션 쿠키(econmind_sid)로 사용자를 구분한다.
// credentials: 'include' 가 없으면 브라우저가 쿠키를 싣지도, 저장하지도 않아
// 매 요청이 새 세션으로 잡히고 사용자별 마인드맵이 동작하지 않는다.
const CREDENTIALS: RequestCredentials = 'include';

/**
 * 백엔드가 실패 이유를 한국어 detail 로 내려준다. 화면이 그걸 그대로 쓸 수 있게
 * 상태 코드와 함께 실어 나른다.
 *
 * 예) POST /reports 는 404 "정치·사회 기사는 제공하지 않습니다",
 *     502 "기사 본문을 추출하지 못해...", 503 "기사 분류를 확인하지 못했습니다..."
 * 를 구분해서 준다. 예전에는 상태 코드만 보고 버려서, 다시 눌러도 절대 안 되는
 * 404 에도 "다시 시도해 주세요" 가 떴다.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** 백엔드가 준 사람이 읽는 메시지. 없으면 undefined. */
    readonly detail: string | undefined,
    method: string,
    path: string,
  ) {
    super(`API ${method} ${path} failed with ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'ApiError';
  }

  /** 다시 눌러 볼 만한 실패인지. 404 는 이 기사에 대해 영구적이다. */
  get retryable(): boolean {
    return this.status !== 404;
  }
}

/** FastAPI 는 오류를 {"detail": "..."} 로 낸다. 검증 실패(422)는 배열이라 거른다. */
async function readDetail(resp: Response): Promise<string | undefined> {
  try {
    const body = await resp.json();
    const detail = (body as { detail?: unknown })?.detail;
    return typeof detail === 'string' && detail.trim() ? detail.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_V1}${path}`, { credentials: CREDENTIALS });
  if (!resp.ok) throw new ApiError(resp.status, await readDetail(resp), 'GET', path);
  return resp.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_V1}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: CREDENTIALS,
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new ApiError(resp.status, await readDetail(resp), 'POST', path);
  return resp.json() as Promise<T>;
}

/**
 * 오류를 화면 문구로 바꾼다.
 *
 * 백엔드 메시지가 있으면 그대로 쓴다 — 이유를 가장 정확히 아는 쪽이고,
 * 필요한 안내(“잠시 후 다시 시도해 주세요”)도 이미 문장에 들어 있다.
 * 우리 문구로 대신할 때만 `retryHint` 를 덧붙이며, 다시 눌러도 결과가 같은
 * 실패(404)에는 붙이지 않는다.
 */
export function errorMessage(error: unknown, fallback: string, retryHint?: string): string {
  if (error instanceof ApiError && error.detail) return error.detail;
  if (!retryHint) return fallback;
  const retryable = !(error instanceof ApiError) || error.retryable;
  return retryable ? `${fallback} ${retryHint}` : fallback;
}

// ── 세션 마인드맵 상태 ────────────────────────────────────────────────────────
// 백엔드 GET/POST /api/v1/session 계약. 화면 연동은 M2 완료 기준에서 제외돼 있어
// 여기서는 타입과 호출부만 둔다(마인드맵 알고리즘 적용은 2026-09-19 보류 결정).

export type SessionState = {
  session_id: string;
  mindmap: {
    center_news_id: string;
    expanded_news_ids: string[];
    query: string;
  };
  viewed_news_ids: string[];
};

/** 현재 세션 상태를 조회한다. 쿠키가 없으면 백엔드가 새로 발급한다. */
export async function fetchSession(): Promise<SessionState> {
  return apiGet<SessionState>('/session');
}

/** 마인드맵에서 노드를 펼쳤음을 세션에 기록한다. */
export async function expandMindmapNode(newsId: string): Promise<SessionState> {
  return apiPost<SessionState>('/session/mindmap/expand', { news_id: newsId });
}

/** 펼친 노드를 접는다. */
export async function collapseMindmapNode(newsId: string): Promise<SessionState> {
  return apiPost<SessionState>('/session/mindmap/collapse', { news_id: newsId });
}

function pickTone(title: string, index: number): NewsCard['thumbnailTone'] {
  const t = title.toLowerCase();
  if (/ai|gpu|hbm|data.?center|nvidia|인공지능|서버/.test(t)) return 'ai';
  if (/chip|semiconductor|반도체|메모리|memory/.test(t)) return 'chip';
  if (/oil|crude|energy|원유|에너지|tariff|관세/.test(t)) return 'oil';
  if (/defense|military|방산|전쟁|war|security/.test(t)) return 'defense';
  if (/ship|freight|해운|물류|logistics|운임/.test(t)) return 'shipping';
  if (/dollar|currency|forex|환율|달러|exchange/.test(t)) return 'currency';
  return TONES[index % TONES.length];
}

function formatDate(value: string): string {
  return (value ?? '').replace('T', ' ').replace('Z', '').slice(0, 16);
}

function slugify(value: string): string {
  return encodeURIComponent(value.toLowerCase().trim()).replace(/%/g, '');
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
