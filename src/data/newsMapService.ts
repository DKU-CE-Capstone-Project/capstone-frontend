/**
 * 뉴스맵 프로토타입 화면의 데이터 서비스 — econmind-docs docs/10 API 계약 구현.
 *
 * 화면(App·NewsMapExplorer)은 이 파일의 함수만 부른다. 기본은 실제 백엔드(/api/v1)이고,
 * VITE_NEWS_MAP_SOURCE=mock 이면 백엔드 없이 브라우저 안의 mock 서비스(mockNewsMap.ts)를 쓴다.
 *
 * | 화면 기능 | API |
 * | 홈 추천 키워드 | GET /keywords/recommended |
 * | 검색어 → 키워드맵 | GET /keywords/related |
 * | 키워드 → 최초 뉴스맵 | GET /news/search 첫 카드 + GET /news/{id}/related |
 * | 하위 펼치기·재검색 | GET /news/{id}/related?exclude_ids= |
 * | 선택 기사 리포트 | POST /reports {news_ids} → GET /reports/{id} 폴링 |
 */

import type { NewsCard, Report } from './mockData';
import {
  MOCK_HOME_KEYWORDS,
  fetchMockKeywordMap,
  fetchMockNewsMap,
  fetchMockRecommendedKeywords,
  fetchMockRelated,
  generateMockReport,
  mockReportTitle,
  type MockKeywordMap,
  type MockNewsMap,
  type ReportPhase,
} from './mockNewsMap';

export type { ReportPhase };
export type KeywordMapData = MockKeywordMap;
export type NewsMapData = MockNewsMap;
export const DEFAULT_HOME_KEYWORDS = MOCK_HOME_KEYWORDS;

/** 탐색 상한 (docs/10 D2): 최대 깊이(중심=0), 맵 전체 기사 수, 부모별 재검색 횟수 */
export const MAX_DEPTH = 4;
export const MAX_MAP_NEWS = 40;
export const MAX_RESEARCH = 5;
/** 리포트 근거 기사 수 상한 (docs/10 D3) */
export const MAX_REPORT_NEWS = 5;

const KEYWORD_MAP_SIZE = 9;
const POLL_START_MS = 1000;
const POLL_MAX_MS = 2000;
const REPORT_TIMEOUT_MS = 120_000;

type Env = { VITE_API_BASE?: string; VITE_NEWS_MAP_SOURCE?: string };
const env: Env = (import.meta as unknown as { env?: Env }).env ?? {};
export const USE_MOCK = env.VITE_NEWS_MAP_SOURCE === 'mock';
const API_V1 = `${(env.VITE_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1`;

// ── HTTP ────────────────────────────────────────────────────────────

export class ServiceError extends Error {
  constructor(message: string, readonly status = 0, readonly body: unknown = undefined) {
    super(message);
    this.name = 'ServiceError';
  }
}

/** 테스트에서 폴링 대기를 없애기 위한 배율 */
let delayScale = 1;
export function setServiceDelayScale(scale: number) {
  delayScale = scale;
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, signal?: AbortSignal) {
  const resp = await fetch(`${API_V1}${path}`, {
    method,
    credentials: 'include', // 세션 쿠키(econmind_sid): 세션당 진행 중 리포트 1건 제한에 쓰인다
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  let data: unknown = undefined;
  try {
    data = await resp.json();
  } catch {
    // 빈 본문
  }
  if (!resp.ok) {
    const detail = (data as { detail?: unknown } | undefined)?.detail;
    const message = typeof detail === 'string' ? detail
      : typeof (detail as { message?: unknown } | undefined)?.message === 'string'
        ? (detail as { message: string }).message
        : `요청에 실패했습니다 (${resp.status})`;
    throw new ServiceError(message, resp.status, detail);
  }
  return { status: resp.status, data: data as T };
}

// ── API 응답 형식 ───────────────────────────────────────────────────

type ApiCard = {
  news_id: string;
  title: string;
  description?: string;
  summary?: string;
  thumbnail_url?: string;
  source_name?: string;
  source_url?: string;
  published_at?: string;
  keywords?: string[];
  categories?: string[];
};

type ApiSelection = { status: string; reason: string | null; requested: number; returned: number; excluded?: number };

type ApiReport = {
  report_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: 'queued' | 'extracting' | 'analyzing' | 'strategy' | 'done';
  progress: { done: number; total: number } | null;
  requested_news_ids: string[];
  title: string;
  summary: string;
  event_analysis: string;
  market_impact: string;
  risk_factors: string[];
  evidence_news: Array<{ news_id: string; body_status?: string }>;
  stock_impacts: Array<{ name: string; ticker: string; direction: 'up' | 'down' | 'mixed'; action: string; comment: string }>;
  strategy: { stance: string; rationale: string; watchlist: string[]; risk_warning: string } | null;
  is_fallback: boolean;
  error: { code: string; message: string } | null;
};

// ── 변환 ────────────────────────────────────────────────────────────

const TONES: NewsCard['thumbnailTone'][] = ['ai', 'chip', 'oil', 'defense', 'shipping', 'currency'];

function pickTone(title: string, index: number): NewsCard['thumbnailTone'] {
  const t = title.toLowerCase();
  if (/ai|gpu|hbm|데이터센터|인공지능|서버/.test(t)) return 'ai';
  if (/반도체|메모리|chip|semiconductor/.test(t)) return 'chip';
  if (/원유|유가|에너지|정유|oil|crude/.test(t)) return 'oil';
  if (/방산|전쟁|국방|defense/.test(t)) return 'defense';
  if (/해운|물류|운임|항만|ship/.test(t)) return 'shipping';
  if (/환율|달러|외환|currency/.test(t)) return 'currency';
  return TONES[index % TONES.length];
}

/** 저장·응답은 원래 시각(UTC)을 유지하고 화면에만 KST "YYYY-MM-DD HH:mm"으로 보인다. */
export function formatKst(value: string | undefined): string {
  if (!value) return '';
  const time = Date.parse(value);
  if (Number.isNaN(time)) return '';
  return new Date(time + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16);
}

export function cardFromApi(card: ApiCard, index = 0): NewsCard {
  return {
    id: card.news_id,
    title: card.title,
    source: card.source_name ?? '',
    publishedAt: formatKst(card.published_at),
    summary: card.description || card.summary || '',
    mockOriginalBody: '',
    sourceUrl: card.source_url || undefined,
    thumbnailTone: pickTone(card.title, index),
    imageUrl: card.thumbnail_url ?? '',
    keywords: card.keywords ?? [],
    categories: card.categories ?? [],
    relatedStockSymbols: [],
    sentiment: 'neutral',
  };
}

const ACTION_LABEL: Record<string, string> = { buy: '매수 관점', hold: '보유 관점', sell: '매도 관점', watch: '관망' };

export function reportFromApi(data: ApiReport): Report {
  const strategy = data.strategy;
  return {
    id: data.report_id,
    clusterId: '',
    title: data.title,
    eventSummary: data.event_analysis || data.summary,
    marketImpact: data.market_impact,
    stockImpacts: data.stock_impacts.map((s) => ({
      symbol: s.ticker && s.ticker !== s.name ? s.ticker : '',
      name: s.name,
      impact: s.comment,
      direction: s.direction,
      actionLabel: ACTION_LABEL[s.action],
    })),
    riskFactors: data.risk_factors,
    strategySummary: strategy
      ? { stance: strategy.stance, rationale: strategy.rationale, watchlist: strategy.watchlist, riskWarning: strategy.risk_warning }
      : null,
    isFallback: data.is_fallback,
    descriptionOnlyCount: data.evidence_news.filter((e) => e.body_status === 'description_only').length,
    requestedNewsIds: data.requested_news_ids,
  };
}

/** 서버 단계 → 화면 3단계 (본문 추출 1 → 분석 2 → 종목·전략 3) */
export function phaseOf(stage: ApiReport['stage']): ReportPhase {
  if (stage === 'analyzing') return 1;
  if (stage === 'strategy') return 2;
  if (stage === 'done') return 3;
  return 0;
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');
}

// ── 서비스 함수 ─────────────────────────────────────────────────────

export async function fetchRecommendedKeywords(limit = 8): Promise<string[]> {
  if (USE_MOCK) return fetchMockRecommendedKeywords(limit);
  const { data } = await request<{ keywords: Array<{ keyword: string }> }>('GET', `/keywords/recommended?limit=${limit}`);
  return data.keywords.map((k) => k.keyword);
}

/** 검색어 → 키워드맵. 가운데 검색어 + 검색 기사에서 고른 연관 키워드(부족하면 추천 키워드). */
export async function fetchKeywordMap(query: string): Promise<KeywordMapData> {
  if (USE_MOCK) return fetchMockKeywordMap(query);
  const q = query.trim();
  if (!q) throw new ServiceError('검색어를 입력해 주세요.');
  const params = new URLSearchParams({ q, limit: String(KEYWORD_MAP_SIZE - 1) });
  const { data } = await request<{ query: string; keywords: Array<{ keyword: string }> }>('GET', `/keywords/related?${params}`);
  const keywords = [data.query, ...data.keywords.map((k) => k.keyword)];
  return { query: data.query, keywords: [...new Set(keywords)].slice(0, KEYWORD_MAP_SIZE) };
}

/** 키워드 → 최초 뉴스맵. 검색 첫 기사를 중심으로, 서버가 고른 주변 기사(최대 3건)를 붙인다. */
export async function fetchNewsMap(keyword: string): Promise<NewsMapData> {
  if (USE_MOCK) return fetchMockNewsMap(keyword);
  const q = keyword.trim();
  const params = new URLSearchParams({ q, size: '20', sort: 'relevance' });
  const { data } = await request<{ news_cards: ApiCard[] }>('GET', `/news/search?${params}`);
  if (!data.news_cards.length) throw new ServiceError(`‘${q}’ 검색 결과가 없습니다.`, 404);
  const root = cardFromApi(data.news_cards[0], 0);
  const related = await fetchRelated(root.id, []);
  return { keyword: q, topicId: '', root, related: related.news, reportTitle: '', reportLabel: '' };
}

export type RelatedResult = { news: NewsCard[]; status: string };

/**
 * 카드 기준 연관 뉴스. excludeIds 는 지금 맵에 있는 기사와 그 카드의 이전 결과 —
 * 하위 펼치기와 재검색이 이미 보이는 기사를 다시 내지 않게 한다. 0건도 정상 결과다.
 */
export async function fetchRelated(newsId: string, excludeIds: string[], batch = 0): Promise<RelatedResult> {
  if (USE_MOCK) return { news: await fetchMockRelated(newsId, batch, { research: batch > 0 }), status: 'complete' };
  const ids = [...new Set(excludeIds.filter((id) => id && id !== newsId))].slice(0, 100);
  const params = new URLSearchParams({ tier: 'FREE' });
  if (ids.length) params.set('exclude_ids', ids.join(','));
  const { data } = await request<{ related_news: ApiCard[]; selection: ApiSelection | null }>(
    'GET', `/news/${encodeURIComponent(newsId)}/related?${params}`);
  return { news: data.related_news.map((card, i) => cardFromApi(card, i + 1)), status: data.selection?.status ?? 'complete' };
}

export function reportTitle(map: Pick<NewsMapData, 'reportTitle'>, evidence: NewsCard[], report: Report | null): string {
  if (report?.title) return report.title;
  if (USE_MOCK) return mockReportTitle(map, evidence);
  if (evidence.length === 1) return `${evidence[0].title} — 영향 리포트`;
  return evidence.length ? `선택한 뉴스 ${evidence.length}건 리포트` : '';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms * delayScale);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** GET /reports/{id} 를 끝날 때까지 1초→2초 간격으로 폴링한다. 120초가 지나면 시간 초과. */
async function pollReport(reportId: string, onPhase: (p: ReportPhase) => void, signal?: AbortSignal): Promise<ApiReport> {
  const started = Date.now();
  let wait = POLL_START_MS;
  for (;;) {
    const { data } = await request<ApiReport>('GET', `/reports/${encodeURIComponent(reportId)}`, undefined, signal);
    if (data.status === 'completed' || data.status === 'failed') return data;
    onPhase(phaseOf(data.stage));
    if ((Date.now() - started) * delayScale > REPORT_TIMEOUT_MS) {
      throw new ServiceError('리포트 생성이 오래 걸리고 있어요. 잠시 후 다시 열어 주세요.');
    }
    await sleep(wait, signal);
    wait = Math.min(POLL_MAX_MS, wait * 1.5);
  }
}

/**
 * 선택한 기사들로 리포트를 만든다 (POST /reports {news_ids} → 폴링).
 * 세션에 다른 리포트가 진행 중이면(409) 그 작업이 끝나기를 기다렸다가 한 번 다시 요청한다
 * — 근거를 바꿔 다시 만들 때 이전 작업은 서버에서 계속 끝까지 진행되기 때문이다.
 */
export async function generateReport(
  map: Pick<NewsMapData, 'reportTitle'>,
  evidence: NewsCard[],
  onPhase: (phase: ReportPhase) => void,
  signal?: AbortSignal,
): Promise<Report> {
  if (USE_MOCK) return generateMockReport(map, evidence, onPhase, signal);
  if (!evidence.length) throw new ServiceError('리포트에 쓸 근거 뉴스가 없습니다.');
  if (evidence.length > MAX_REPORT_NEWS) {
    throw new ServiceError(`리포트 근거는 최대 ${MAX_REPORT_NEWS}건까지 고를 수 있어요.`);
  }
  const newsIds = evidence.map((n) => n.id);
  onPhase(0);

  let created: { report_id: string; status: string } | null = null;
  for (let attempt = 0; attempt < 2 && !created; attempt++) {
    try {
      created = (await request<{ report_id: string; status: string }>('POST', '/reports', { news_ids: newsIds }, signal)).data;
    } catch (error) {
      const active = error instanceof ServiceError && error.status === 409
        ? (error.body as { report_id?: string } | undefined)?.report_id : undefined;
      if (!active || attempt > 0) throw error;
      await pollReport(active, () => undefined, signal);
    }
  }
  const result = await pollReport(created!.report_id, onPhase, signal);
  if (result.status === 'failed') throw new ServiceError(result.error?.message ?? '리포트를 만들지 못했어요.');
  if (!sameSet(result.requested_news_ids, newsIds)) throw new ServiceError('근거가 바뀌어 이전 리포트를 버렸어요.');
  return reportFromApi(result);
}
