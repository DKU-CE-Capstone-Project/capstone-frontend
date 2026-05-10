/**
 * API adapter — bridges the FastAPI /analyze response to the UI's
 * IssueCluster / NewsCard / Report data model.
 *
 * Dynamic data is stored in module-level Maps so React re-renders
 * pick up new data after state updates trigger a render cycle.
 */

import {
  clusters as staticClusters,
  newsCards as staticNewsCards,
  reports as staticReports,
  type IssueCluster,
  type NewsCard,
  type Report,
} from './mockData';

// ── Module-level caches (survive re-renders, reset on page reload) ──────────
export const dynClusters = new Map<string, IssueCluster>();
export const dynNews = new Map<string, NewsCard>();
export const dynReports = new Map<string, Report>();

// ── Resolver functions (check dynamic cache, fall back to static mock) ──────
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
  // Dynamic clusters first
  for (const c of dynClusters.values()) {
    if (
      c.query.toLowerCase().includes(normalized) ||
      c.recommendedKeywords.some((k) => k.toLowerCase().includes(normalized))
    ) {
      return c;
    }
  }
  // Static mock data
  return (
    staticClusters.find((c) => {
      return (
        c.query.toLowerCase().includes(normalized) ||
        c.recommendedKeywords.some((k) => k.toLowerCase().includes(normalized))
      );
    }) ?? staticClusters[0]
  );
}

// ── Image / tone helpers ─────────────────────────────────────────────────────
const TONES: NewsCard['thumbnailTone'][] = [
  'ai', 'chip', 'oil', 'defense', 'shipping', 'currency',
];

const IMAGES = [
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1516937941344-00b4e0337589?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=520&q=80',
  'https://images.unsplash.com/photo-1517976547714-720226b864c1?auto=format&fit=crop&w=520&q=80',
];

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

// ── API fetch + cache ────────────────────────────────────────────────────────
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

type ApiArticle = {
  title: string;
  url: string;
  source: string;
  published_at: string;
  summary: string;
};

type ApiResponse = {
  keyword: string;
  articles: ApiArticle[];
  related_keywords: string[];
};

export async function fetchAndCacheCluster(term: string): Promise<IssueCluster> {
  const clusterId = `api-${term.toLowerCase().trim()}`;

  // Return cached result if already fetched this session
  if (dynClusters.has(clusterId)) {
    return dynClusters.get(clusterId)!;
  }

  const resp = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: term }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data: ApiResponse = await resp.json();

  // Map articles → NewsCard[]
  const newsIds: string[] = data.articles.map((art, i) => {
    const id = `${clusterId}-${i}`;
    const card: NewsCard = {
      id,
      title: art.title,
      source: art.source,
      publishedAt: (art.published_at ?? '').replace('T', ' ').slice(0, 16),
      summary: art.summary,
      mockOriginalBody: art.summary,
      thumbnailTone: pickTone(art.title, i),
      imageUrl: IMAGES[i % IMAGES.length],
      keywords: [term, ...data.related_keywords.slice(0, 3)],
      relatedStockSymbols: [],
      sentiment: 'neutral',
    };
    dynNews.set(id, card);
    return id;
  });

  // Build a lightweight Report from the API data
  const reportId = `${clusterId}-report`;
  const report: Report = {
    id: reportId,
    clusterId,
    title: `${term} 관련 뉴스 분석 리포트`,
    eventSummary: data.articles[0]?.summary ?? '',
    marketImpact: `${term} 관련 최신 뉴스 ${data.articles.length}건을 분석했습니다. 관련 키워드: ${data.related_keywords.slice(0, 4).join(', ')}.`,
    stockImpacts: [],
    riskFactors: data.related_keywords.slice(3, 7),
    strategySummary: {
      stance: '정보 수집 중',
      rationale: `${term} 관련 뉴스를 실시간으로 모니터링하고 있습니다. 추가 분석을 위해 관련 키워드를 탐색해 보세요.`,
      watchlist: data.related_keywords.slice(0, 4),
      riskWarning: '실제 투자 판단은 추가적인 분석과 전문가 의견이 필요합니다.',
    },
  };
  dynReports.set(reportId, report);

  // Build IssueCluster
  const cluster: IssueCluster = {
    id: clusterId,
    query: term,
    mainNewsId: newsIds[0] ?? staticNewsCards[0].id,
    relatedNewsIds: newsIds.slice(1),
    recommendedKeywords: data.related_keywords,
    reportId,
  };
  dynClusters.set(clusterId, cluster);

  return cluster;
}
