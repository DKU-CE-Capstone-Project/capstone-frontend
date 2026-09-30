import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Exercise the production adapter with mocked HTTP; no extra test framework.
const temporary = await mkdtemp(join(tmpdir(), 'econmind-news-map-'));
const bundle = join(temporary, 'adapter.mjs');
await build({
  entryPoints: ['src/data/apiAdapter.ts'], bundle: true, format: 'esm',
  platform: 'node', outfile: bundle, define: { 'import.meta.env': '{}' },
});
const adapter = await import(pathToFileURL(bundle).href);
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(temporary, { recursive: true, force: true });
});
beforeEach(() => {
  adapter.dynClusters.clear();
  adapter.dynNews.clear();
});

function cluster() {
  const value = { id: 'test', query: 'AI', mainNewsId: 'center', relatedNewsIds: ['unvetted'],
    recommendedKeywords: [], reportId: 'placeholder' };
  adapter.dynClusters.set(value.id, value);
  return value;
}
const item = (news_id, distance = 1) => ({ news_id, title: news_id, summary: '', thumbnail_url: '', distance });
const ok = (data) => ({ ok: true, json: async () => data });

test('search preserves first center and does not display unscored candidates', async () => {
  globalThis.fetch = async (url) => String(url).includes('/keywords/')
    ? ok({ keywords: [] })
    : ok({ news_cards: ['first', 'candidate'].map((news_id) => ({ ...item(news_id),
      source_name: '', published_at: '', related_stock_names: [] })), total_count: 2 });
  const result = await adapter.fetchAndCacheNewsCluster('AI');
  assert.equal(result.mainNewsId, 'first');
  assert.deepEqual(result.relatedNewsIds, []);
  assert.ok(adapter.dynNews.has('candidate'));
});

test('server relevance order survives distance differences without graph top-up', async () => {
  cluster();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return ok({ related_news: [item('high', 2), item('lower', 1)] });
  };
  const result = await adapter.fetchAndCacheNewsMap('center', 'test', 6);
  assert.deepEqual(result.relatedNewsIds, ['high', 'lower']);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('/related?limit=6&tier=FREE'));
});

test('empty selection stays empty', async () => {
  cluster();
  globalThis.fetch = async () => ok({ related_news: [] });
  assert.deepEqual((await adapter.fetchAndCacheNewsMap('center', 'test')).relatedNewsIds, []);
});

test('failure propagates and clears prior center/candidate fallback', async () => {
  cluster();
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ detail: '임베딩 실패' }) });
  await assert.rejects(adapter.fetchAndCacheNewsMap('new-center', 'test'), /임베딩 실패/);
  assert.equal(adapter.resolveCluster('test').mainNewsId, 'new-center');
  assert.deepEqual(adapter.resolveCluster('test').relatedNewsIds, []);
});

test('late response for previous center does not replace current ranking', async () => {
  cluster();
  let finishOld;
  globalThis.fetch = async (url) => String(url).includes('/old-center/')
    ? new Promise((resolve) => { finishOld = resolve; })
    : ok({ related_news: [item('new-neighbour')] });
  const old = adapter.fetchAndCacheNewsMap('old-center', 'test');
  await adapter.fetchAndCacheNewsMap('new-center', 'test');
  finishOld(ok({ related_news: [item('old-neighbour')] }));
  await old;
  assert.equal(adapter.resolveCluster('test').mainNewsId, 'new-center');
  assert.deepEqual(adapter.resolveCluster('test').relatedNewsIds, ['new-neighbour']);
});

function fullCard(news_id = 'new-neighbour') {
  return { ...item(news_id), title: 'HBM 생산 확대', description: 'NAVER 기사 설명',
    summary: 'Older summary', source_name: 'publisher.test',
    source_url: `https://n.news.naver.com/article/214/${news_id}`,
    published_at: '2026-09-30T09:00:00Z', thumbnail_url: 'https://publisher.test/news.jpg',
    keywords: ['HBM', 'AI'], categories: ['반도체'], related_stock_names: [] };
}

test('uncached related article contains detail metadata without another request', async () => {
  cluster();
  const card = fullCard();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return ok({ related_news: [card] });
  };
  await adapter.fetchAndCacheNewsMap('center', 'test');
  const result = adapter.findKnownNews(card.news_id);
  assert.equal(result.source, card.source_name);
  assert.ok(result.publishedAt.includes('2026'));
  assert.equal(result.sourceUrl, card.source_url);
  assert.equal(result.summary, card.description);
  assert.equal(result.imageUrl, card.thumbnail_url);
  assert.deepEqual(result.keywords, card.keywords);
  assert.deepEqual(result.categories, card.categories);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('/related?'));
});

test('search uses article tags and new related response can clear stale metadata', async () => {
  const card = fullCard();
  globalThis.fetch = async (url) => String(url).includes('/keywords/')
    ? ok({ keywords: [] }) : ok({ news_cards: [card], total_count: 1 });
  await adapter.fetchAndCacheNewsCluster('검색어');
  assert.deepEqual(adapter.findKnownNews(card.news_id).keywords, ['HBM', 'AI']);
  assert.deepEqual(adapter.findKnownNews(card.news_id).categories, ['반도체']);
  cluster();
  globalThis.fetch = async () => ok({ related_news: [{ ...card,
    description: '수정된 기사 설명', source_url: 'https://publisher.test/revised',
    keywords: [], categories: [] }] });
  await adapter.fetchAndCacheNewsMap('center', 'test');
  const result = adapter.findKnownNews(card.news_id);
  assert.equal(result.summary, '수정된 기사 설명');
  assert.equal(result.sourceUrl, 'https://publisher.test/revised');
  assert.deepEqual(result.keywords, []);
  assert.deepEqual(result.categories, []);
});

test('older related response preserves cached detail metadata', async () => {
  cluster();
  const card = fullCard();
  globalThis.fetch = async () => ok({ related_news: [card] });
  await adapter.fetchAndCacheNewsMap('center', 'test');
  const original = adapter.findKnownNews(card.news_id);
  globalThis.fetch = async () => ok({ related_news: [{ ...item(card.news_id), summary: 'Legacy description' }] });
  await adapter.fetchAndCacheNewsMap('center', 'test');
  const result = adapter.findKnownNews(card.news_id);
  for (const key of ['source', 'publishedAt', 'sourceUrl', 'imageUrl', 'keywords', 'categories']) {
    assert.deepEqual(result[key], original[key]);
  }
  assert.equal(result.summary, 'Legacy description');
});

test('source adapter fills description and metadata without borrowing a sample article', async () => {
  const card = fullCard('source-only');
  globalThis.fetch = async () => ok({ ...card, original_title: card.title, original_body: '' });
  const result = await adapter.fetchAndCacheNewsSource(card.news_id);
  assert.equal(result.id, card.news_id);
  assert.equal(result.title, card.title);
  assert.equal(result.summary, card.description);
  assert.equal(result.sourceUrl, card.source_url);
  assert.deepEqual(result.keywords, card.keywords);
  assert.deepEqual(result.categories, card.categories);
  assert.deepEqual(result.relatedStockSymbols, []);
});

test('empty description keeps the server compatibility summary', async () => {
  cluster();
  const card = { ...fullCard(), description: '', summary: '저장된 설명' };
  globalThis.fetch = async () => ok({ related_news: [card] });
  await adapter.fetchAndCacheNewsMap('center', 'test');
  assert.equal(adapter.findKnownNews(card.news_id).summary, card.summary);
});
