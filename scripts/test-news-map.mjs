import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// Exercise the production adapter with mocked HTTP; no extra test framework.
const temporary = await mkdtemp(join(tmpdir(), 'econmind-news-map-'));
const bundle = join(temporary, 'adapter.mjs');
await build({
  entryPoints: ['src/data/apiAdapter.ts'], bundle: true, format: 'esm',
  platform: 'node', outfile: bundle, define: { 'import.meta.env': '{}' },
});
const adapter = await import(pathToFileURL(bundle).href);
await build({
  entryPoints: ['src/components/NewsMapStatus.tsx', 'src/layout/mapLayout.ts'], bundle: true,
  format: 'esm', platform: 'node', outdir: join(temporary, 'view'), outbase: 'src',
  // Resolve React from this project's lockfile rather than the temporary directory.
  external: [],
});
const { NewsMapStatus } = await import(pathToFileURL(join(temporary, 'view/components/NewsMapStatus.js')).href);
const layout = await import(pathToFileURL(join(temporary, 'view/layout/mapLayout.js')).href);
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

test('server MMR order survives descending score and distance differences without graph top-up', async () => {
  cluster();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return ok({ related_news: [{ ...item('first', 2), relevance_score: .95 },
      { ...item('diverse', 1), relevance_score: .72 }, { ...item('higher-score', 1), relevance_score: .9 }] });
  };
  const result = await adapter.fetchAndCacheNewsMap('center', 'test', 6);
  assert.deepEqual(result.relatedNewsIds, ['first', 'diverse', 'higher-score']);
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

for (const count of [0, 1, 2]) {
  test(`${count} neighbours preserve exact count, order and uncached metadata with useful status`, async () => {
    cluster();
    const cards = Array.from({ length: count }, (_, i) => fullCard(`new-${i}`));
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      return ok({ related_news: cards });
    };
    const result = await adapter.fetchAndCacheNewsMap('center', 'test');
    assert.deepEqual(result.relatedNewsIds, cards.map(c => c.news_id));
    assert.equal(calls.length, 1);
    for (const card of cards) {
      const cached = adapter.findKnownNews(card.news_id);
      assert.equal(cached.summary, card.description);
      assert.equal(cached.sourceUrl, card.source_url);
      assert.deepEqual(cached.keywords, card.keywords);
    }
    for (const profile of [layout.NEWS_PROFILE_FULL, layout.NEWS_PROFILE_MOBILE, layout.NEWS_PROFILE_COMPACT]) {
      const nodes = layout.layoutNewsMap('center', result.relatedNewsIds, profile);
      assert.deepEqual(nodes.map(n => n.id), ['center', ...result.relatedNewsIds]);
      assert.equal(nodes.length, count + 1);
      assert.ok(nodes.every(n => [n.x, n.y, n.size].every(Number.isFinite)));
      assert.ok(nodes.every(n => n.x - n.size / 2 >= 0 && n.x + n.size / 2 <= profile.field.width
        && n.y - n.size / 2 >= 0 && n.y + n.size / 2 <= profile.field.height));
    }
    const markup = renderToStaticMarkup(createElement(NewsMapStatus, { count, pending: false, error: null }));
    assert.ok(markup.includes('role="status"'));
    assert.ok(markup.includes(count === 0 ? '연결할 연관 기사가 없습니다' : `연관 기사 ${count}개`));
    assert.equal(renderToStaticMarkup(createElement(NewsMapStatus, { count, pending: true, error: null })), '');
  });
}

test('map status retains explicit error and omits shortage notice for a full map', () => {
  const markup = renderToStaticMarkup(createElement(NewsMapStatus, { count: 0, pending: false, error: '추가 검색 실패' }));
  assert.ok(markup.includes('role="alert"') && markup.includes('추가 검색 실패'));
  assert.ok(!markup.includes('연결할 연관 기사가 없습니다'));
  assert.equal(renderToStaticMarkup(createElement(NewsMapStatus, { count: 3, pending: false, error: null })), '');
});
