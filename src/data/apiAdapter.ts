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
  news_id: string;
  title: string;
  summary: string;
  thumbnail_url: string;
  source_name: string;
  published_at: string;
  related_stock_names: string[];
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
};

type ApiGraphNode = {
  news_id: string;
  title: string;
  summary: string;
  distance: number;
  is_center?: boolean;
};

type ApiGraphResponse = {
  center_node: ApiGraphNode;
  nodes: ApiGraphNode[];
  edges: Array<{
    source: string;
    target: string;
    relation_type: string;
    distance: number;
  }>;
};

type ApiRelatedNewsItem = {
  news_id: string;
  title: string;
  summary: string;
  thumbnail_url: string;
  relevance_score?: number | null;
  distance: number;
};

type ApiRelatedResponse = {
  related_news: ApiRelatedNewsItem[];
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
  const clusterId = `api-v1-${slugify(trimmed)}`;

  if (dynClusters.has(clusterId)) {
    return dynClusters.get(clusterId)!;
  }

  const params = new URLSearchParams({
    q: trimmed,
    page: '1',
    size: '10',
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

export async function fetchAndCacheNewsMap(
  newsId: string,
  currentClusterId: string,
): Promise<IssueCluster> {
  const currentCluster = resolveCluster(currentClusterId);
  const [graphData, relatedData] = await Promise.all([
    apiGet<ApiGraphResponse>(
      `/news/${encodeURIComponent(newsId)}/graph?depth=2&limit=10&include_distance=true`,
    ),
    apiGet<ApiRelatedResponse>(
      `/news/${encodeURIComponent(newsId)}/related?limit=3&tier=FREE`,
    ),
  ]);

  const centerCard = graphNodeToNewsCard(graphData.center_node, currentCluster.query, 0);
  cacheNewsCard(centerCard);

  const relatedIds = relatedData.related_news.map((item, index) => {
    const card = relatedItemToNewsCard(item, currentCluster.query, index + 1);
    cacheNewsCard(card);
    return card.id;
  });

  if (relatedIds.length < 3) {
    for (const node of graphData.nodes) {
      if (node.news_id === newsId || relatedIds.includes(node.news_id)) continue;
      const card = graphNodeToNewsCard(node, currentCluster.query, relatedIds.length + 1);
      cacheNewsCard(card);
      relatedIds.push(card.id);
      if (relatedIds.length >= 3) break;
    }
  }

  const nextCluster: IssueCluster = {
    ...currentCluster,
    id: currentClusterId,
    mainNewsId: newsId,
    relatedNewsIds: relatedIds,
  };
  dynClusters.set(currentClusterId, nextCluster);
  return nextCluster;
}

export async function fetchAndCacheNewsSource(newsId: string): Promise<NewsCard> {
  const source = await apiGet<ApiSourceResponse>(`/news/${encodeURIComponent(newsId)}/source`);
  const existing = resolveNews(newsId);
  const updated: NewsCard = {
    ...existing,
    title: source.original_title || existing.title,
    source: source.source_name || existing.source,
    publishedAt: formatDate(source.published_at) || existing.publishedAt,
    mockOriginalBody: existing.mockOriginalBody,
    sourceUrl: source.source_url || existing.sourceUrl,
  };
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
      return cacheFrontendMockReport(clusterId, newsId);
    }

    const report = mapApiReport(apiReport, clusterId, strategy);
    cacheReportForCluster(clusterId, report);
    return report;
  } catch {
    return cacheFrontendMockReport(clusterId, newsId);
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
    ...cards.flatMap((card) => card.related_stock_names),
  ]).slice(0, 11);

  const cluster: IssueCluster = {
    id: clusterId,
    query,
    mainNewsId: newsIds[0] ?? staticNewsCards[0].id,
    relatedNewsIds: newsIds.slice(1),
    recommendedKeywords: keywords.length > 0 ? keywords : staticClusters[0].recommendedKeywords,
    reportId: `${clusterId}-report-placeholder`,
  };

  dynClusters.set(clusterId, cluster);
  return cluster;
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
    stockImpacts: apiReport.related_stocks.map((stock) => ({
      symbol: stock,
      name: stock,
      impact: apiReport.market_impact,
      direction: 'mixed',
    })),
    riskFactors: apiReport.risk_factors,
    strategySummary: strategy
      ? {
          stance: `전략 ${strategy.risk}`,
          rationale: strategy.strategy_summary,
          watchlist: strategy.strategy_items.map((item) => item.stock_name || item.ticker),
          riskWarning: `예상 수익률 ${strategy.expected_return}%, 기간 ${strategy.period}`,
        }
      : {
          stance: '전략 생성 대기',
          rationale: apiReport.summary,
          watchlist: apiReport.related_stocks,
          riskWarning: apiReport.risk_factors[0] ?? '추가 리스크 검토가 필요합니다.',
        },
  };
}

function cacheFrontendMockReport(clusterId: string, newsId: string): Report {
  const report = buildFrontendMockReport(clusterId, newsId);
  cacheReportForCluster(clusterId, report);
  return report;
}

function cacheReportForCluster(clusterId: string, report: Report) {
  dynReports.set(report.id, report);

  const cluster = resolveCluster(clusterId);
  dynClusters.set(clusterId, { ...cluster, reportId: report.id });
}

function buildFrontendMockReport(clusterId: string, newsId: string): Report {
  const cluster = resolveCluster(clusterId);
  const centerNews = resolveNews(newsId);
  const haystack = [
    cluster.query,
    centerNews.title,
    centerNews.summary,
    ...centerNews.keywords,
  ].join(' ').toLowerCase();
  const template =
    /ai|nvidia|엔비디아|삼성|반도체|hbm|gpu|서버/.test(haystack)
      ? staticReports.find((report) => report.id === 'report-ai') ?? staticReports[0]
      : staticReports.find((report) => report.id === 'report-oil') ?? staticReports[0];

  return {
    ...template,
    id: `${clusterId}-frontend-mock-report`,
    clusterId,
    title: `${centerNews.title.slice(0, 30)} — 투자 분석 리포트`,
    stockImpacts: template.stockImpacts.map((stock) => ({ ...stock })),
    riskFactors: [...template.riskFactors],
    strategySummary: {
      ...template.strategySummary,
      watchlist: [...template.strategySummary.watchlist],
    },
  };
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
  return {
    id: card.news_id,
    title: card.title,
    source: card.source_name,
    publishedAt: formatDate(card.published_at),
    summary: card.summary,
    mockOriginalBody: card.summary,
    sourceUrl: undefined,
    thumbnailTone: pickTone(card.title, index),
    imageUrl: card.thumbnail_url || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    keywords: unique([query, ...card.related_stock_names]).slice(0, 4),
    relatedStockSymbols: card.related_stock_names,
    sentiment: 'neutral',
  };
}

function graphNodeToNewsCard(node: ApiGraphNode, query: string, index: number): NewsCard {
  const existing = findKnownNews(node.news_id);
  return {
    id: node.news_id,
    title: node.title,
    source: existing?.source ?? 'News API',
    publishedAt: existing?.publishedAt ?? '',
    summary: node.summary,
    mockOriginalBody: existing?.mockOriginalBody ?? node.summary,
    sourceUrl: existing?.sourceUrl,
    thumbnailTone: existing?.thumbnailTone ?? pickTone(node.title, index),
    imageUrl: existing?.imageUrl ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    keywords: existing?.keywords ?? unique([query, ...node.title.split(/\s+/)]).slice(0, 4),
    relatedStockSymbols: existing?.relatedStockSymbols ?? [],
    sentiment: existing?.sentiment ?? 'neutral',
  };
}

function relatedItemToNewsCard(item: ApiRelatedNewsItem, query: string, index: number): NewsCard {
  const existing = findKnownNews(item.news_id);
  return {
    id: item.news_id,
    title: item.title,
    source: existing?.source ?? 'Related News',
    publishedAt: existing?.publishedAt ?? '',
    summary: item.summary,
    mockOriginalBody: existing?.mockOriginalBody ?? item.summary,
    sourceUrl: existing?.sourceUrl,
    thumbnailTone: existing?.thumbnailTone ?? pickTone(item.title, index),
    imageUrl: item.thumbnail_url || existing?.imageUrl || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    keywords: existing?.keywords ?? unique([query, ...item.title.split(/\s+/)]).slice(0, 4),
    relatedStockSymbols: existing?.relatedStockSymbols ?? [],
    sentiment: existing?.sentiment ?? 'neutral',
  };
}

function mergeNewsCard(existing: NewsCard, next: NewsCard): NewsCard {
  return {
    ...existing,
    ...next,
    source: next.source || existing.source,
    publishedAt: next.publishedAt || existing.publishedAt,
    mockOriginalBody: next.mockOriginalBody || existing.mockOriginalBody,
    imageUrl: next.imageUrl || existing.imageUrl,
    keywords: next.keywords.length > 0 ? next.keywords : existing.keywords,
    relatedStockSymbols:
      next.relatedStockSymbols.length > 0 ? next.relatedStockSymbols : existing.relatedStockSymbols,
  };
}

function cacheNewsCard(next: NewsCard): void {
  const existing = findKnownNews(next.id);
  dynNews.set(next.id, existing ? mergeNewsCard(existing, next) : next);
}

function findKnownNews(id: string): NewsCard | undefined {
  return dynNews.get(id) ?? staticNewsCards.find((news) => news.id === id);
}

async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_V1}${path}`);
  if (!resp.ok) throw new Error(`API GET ${path} failed with ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${API_V1}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`API POST ${path} failed with ${resp.status}`);
  return resp.json() as Promise<T>;
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
