import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// 뉴스맵 서비스 계층(newsMapService.ts)의 실제 API 경로를 가짜 fetch 로 검증한다 (econmind-docs docs/10).
const temporary = await mkdtemp(join(tmpdir(), 'econmind-news-map-service-'));
const bundle = join(temporary, 'service.mjs');
await build({
  entryPoints: ['src/data/newsMapService.ts'], bundle: true, format: 'esm', platform: 'node', outfile: bundle,
  define: { 'import.meta.env': '{"VITE_API_BASE":"http://api.test"}' },
});
const service = await import(pathToFileURL(bundle).href);
service.setServiceDelayScale(0);
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(temporary, { recursive: true, force: true });
});

/** routes: [[method, pathPrefix, (url, body) => [status, json]]] — 순서대로 첫 일치를 쓴다. */
function serve(routes) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname, query: Object.fromEntries(url.searchParams), body,
      credentials: init.credentials });
    const route = routes.find(([m, prefix]) => m === method && url.pathname.startsWith(prefix));
    if (!route) throw new Error(`unexpected ${method} ${url.pathname}`);
    const [status, json] = route[2](url, body, calls);
    return { ok: status < 400, status, json: async () => json };
  };
  return calls;
}

const card = (news_id, extra = {}) => ({
  news_id, title: `${news_id} 제목`, description: `${news_id} 설명`, summary: '', thumbnail_url: '',
  source_name: 'n.news.naver.com', source_url: `https://n.news.naver.com/${news_id}`,
  published_at: '2026-10-01T23:30:00Z', keywords: ['원유'], categories: ['경제'], ...extra,
});

const report = (overrides = {}) => ({
  report_id: 'rpt_1', status: 'completed', stage: 'done', progress: null, requested_news_ids: ['a', 'b'],
  title: '원유 리포트', summary: '요약', event_analysis: '사건', market_impact: '영향', risk_factors: ['환율'],
  evidence_news: [{ news_id: 'a', body_status: 'extracted' }, { news_id: 'b', body_status: 'description_only' }],
  stock_impacts: [{ name: 'S-Oil', ticker: '010950', direction: 'up', action: 'buy', comment: '정제마진' },
    { name: '대한항공', ticker: '대한항공', direction: 'down', action: 'watch', comment: '' }],
  strategy: { stance: '선별 관심', rationale: '근거', watchlist: ['S-Oil'], risk_warning: '변동성' },
  is_fallback: false, error: null, ...overrides,
});

test('keyword map puts the query first and keeps at most nine keywords', async () => {
  const calls = serve([['GET', '/api/v1/keywords/related', () => [200, {
    query: '원유', article_total: 20,
    keywords: ['호르무즈', '정유', '원유', ...Array.from({ length: 10 }, (_, i) => `k${i}`)].map((keyword) => ({ keyword })),
  }]]]);
  const map = await service.fetchKeywordMap('  원유 ');
  assert.equal(map.query, '원유');
  assert.deepEqual(map.keywords.slice(0, 3), ['원유', '호르무즈', '정유']);
  assert.equal(map.keywords.length, 9);
  assert.deepEqual(calls[0].query, { q: '원유', limit: '8' });
  assert.equal(calls[0].credentials, 'include');
});

test('news map uses the first search card as the center and the server-selected neighbours', async () => {
  const calls = serve([
    ['GET', '/api/v1/news/search', () => [200, { news_cards: [card('c'), card('x')], total_count: 2 }]],
    ['GET', '/api/v1/news/c/related', () => [200, { related_news: [card('r1'), card('r2')], selection: { status: 'insufficient' } }]],
  ]);
  const map = await service.fetchNewsMap('원유');
  assert.equal(map.root.id, 'c');
  assert.deepEqual(map.related.map((n) => n.id), ['r1', 'r2']);
  assert.equal(map.root.publishedAt, '2026-10-02 08:30'); // UTC 23:30 → KST 08:30
  assert.equal(map.root.summary, 'c 설명');
  assert.equal(map.root.sourceUrl, 'https://n.news.naver.com/c');
  assert.deepEqual(calls[0].query, { q: '원유', size: '20', sort: 'relevance' });
  assert.equal(calls[1].query.exclude_ids, undefined);
});

test('an empty search is a 404 service error, not a sample map', async () => {
  serve([['GET', '/api/v1/news/search', () => [200, { news_cards: [], total_count: 0 }]]]);
  await assert.rejects(service.fetchNewsMap('없는말'), (error) => error.status === 404 && /검색 결과가 없습니다/.test(error.message));
});

test('related requests send unique exclusions without the base article, and an empty result is normal', async () => {
  const calls = serve([['GET', '/api/v1/news/k1/related', () => [200, { related_news: [], selection: { status: 'insufficient' } }]]]);
  const result = await service.fetchRelated('k1', ['root', 'k1', 'k2', 'root', '']);
  assert.deepEqual(result.news, []);
  assert.equal(calls[0].query.exclude_ids, 'root,k2');
  assert.equal(calls[0].query.tier, 'FREE');
});

test('missing source URL stays empty instead of a generic portal link', () => {
  assert.equal(service.cardFromApi(card('z', { source_url: '' })).sourceUrl, undefined);
});

test('selection report posts news_ids, follows server stages and maps the result', async () => {
  let polls = 0;
  const calls = serve([
    ['POST', '/api/v1/reports', () => [202, { report_id: 'rpt_1', status: 'pending' }]],
    ['GET', '/api/v1/reports/rpt_1', () => {
      polls += 1;
      if (polls === 1) return [200, report({ status: 'processing', stage: 'extracting', progress: { done: 1, total: 2 } })];
      if (polls === 2) return [200, report({ status: 'processing', stage: 'analyzing' })];
      return [200, report()];
    }],
  ]);
  const phases = [];
  const result = await service.generateReport({ reportTitle: '' }, [{ id: 'a' }, { id: 'b' }], (p) => phases.push(p));
  assert.deepEqual(calls[0].body, { news_ids: ['a', 'b'] });
  assert.deepEqual(phases, [0, 0, 1]);
  assert.equal(result.title, '원유 리포트');
  assert.equal(result.eventSummary, '사건');
  assert.deepEqual(result.stockImpacts, [
    { symbol: '010950', name: 'S-Oil', impact: '정제마진', direction: 'up', actionLabel: '매수 관점' },
    { symbol: '', name: '대한항공', impact: '', direction: 'down', actionLabel: '관망' },
  ]);
  assert.deepEqual(result.strategySummary, { stance: '선별 관심', rationale: '근거', watchlist: ['S-Oil'], riskWarning: '변동성' });
  assert.equal(result.descriptionOnlyCount, 1);
  assert.equal(result.isFallback, false);
});

test('a running report in the session (409) is awaited, then the request is retried once', async () => {
  let posts = 0;
  const calls = serve([
    ['POST', '/api/v1/reports', () => (++posts === 1
      ? [409, { detail: { message: '진행 중', report_id: 'rpt_old' } }]
      : [202, { report_id: 'rpt_1', status: 'pending' }])],
    ['GET', '/api/v1/reports/rpt_old', () => [200, report({ report_id: 'rpt_old', requested_news_ids: ['a'] })]],
    ['GET', '/api/v1/reports/rpt_1', () => [200, report()]],
  ]);
  const result = await service.generateReport({ reportTitle: '' }, [{ id: 'b' }, { id: 'a' }], () => {});
  assert.equal(result.id, 'rpt_1');
  assert.deepEqual(calls.map((c) => `${c.method} ${c.path}`), [
    'POST /api/v1/reports', 'GET /api/v1/reports/rpt_old', 'POST /api/v1/reports', 'GET /api/v1/reports/rpt_1']);
});

test('failed reports surface the public message; fallback reports hide the strategy', async () => {
  serve([
    ['POST', '/api/v1/reports', () => [202, { report_id: 'rpt_1' }]],
    ['GET', '/api/v1/reports/rpt_1', () => [200, report({ status: 'failed', stage: 'extracting',
      error: { code: 'body_extraction_failed', message: '본문을 하나도 추출하지 못했습니다.' } })]],
  ]);
  await assert.rejects(service.generateReport({}, [{ id: 'a' }, { id: 'b' }], () => {}), /본문을 하나도 추출하지 못했습니다/);

  serve([
    ['POST', '/api/v1/reports', () => [200, { report_id: 'rpt_1', status: 'completed' }]],
    ['GET', '/api/v1/reports/rpt_1', () => [200, report({ is_fallback: true, strategy: null, stock_impacts: [] })]],
  ]);
  const fallback = await service.generateReport({}, [{ id: 'a' }, { id: 'b' }], () => {});
  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.strategySummary, null);
});

test('a result for a different evidence set is discarded; more than five articles are refused', async () => {
  serve([
    ['POST', '/api/v1/reports', () => [202, { report_id: 'rpt_1' }]],
    ['GET', '/api/v1/reports/rpt_1', () => [200, report({ requested_news_ids: ['a', 'zzz'] })]],
  ]);
  await assert.rejects(service.generateReport({}, [{ id: 'a' }, { id: 'b' }], () => {}), /근거가 바뀌어/);
  await assert.rejects(service.generateReport({}, ['1', '2', '3', '4', '5', '6'].map((id) => ({ id })), () => {}), /최대 5건/);
});

test('stage to phase mapping', () => {
  assert.deepEqual(['queued', 'extracting', 'analyzing', 'strategy', 'done'].map(service.phaseOf), [0, 0, 1, 2, 3]);
});
