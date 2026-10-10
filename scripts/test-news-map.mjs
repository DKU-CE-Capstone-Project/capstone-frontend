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
// Components with hooks must share react-dom/server's React instance, so React stays
// external and the view bundle lives under node_modules where it resolves.
const viewDir = await mkdtemp(join(process.cwd(), 'node_modules', '.econmind-news-map-view-'));
await build({
  entryPoints: ['src/components/NewsMapStatus.tsx', 'src/components/NewsMapCanvas.tsx', 'src/layout/mapLayout.ts'],
  bundle: true,
  format: 'esm', platform: 'node', outdir: viewDir, outbase: 'src',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'lucide-react', 'motion/react'],
});
const { NewsMapStatus } = await import(pathToFileURL(join(viewDir, 'components/NewsMapStatus.js')).href);
const { NewsMapCanvas } = await import(pathToFileURL(join(viewDir, 'components/NewsMapCanvas.js')).href);
const layout = await import(pathToFileURL(join(viewDir, 'layout/mapLayout.js')).href);
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await rm(temporary, { recursive: true, force: true });
  await rm(viewDir, { recursive: true, force: true });
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

// ── 대표 기사와 구버전 응답 호환·확장 상태 ─────────────────────────────

const selection = (status, returned, requested = 3) => ({ status, reason: null, requested, returned });

test('legacy grouping fields are ignored while normal article details stay cached', async () => {
  cluster();
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return ok({
      related_news: [{ ...fullCard('angle'), same_story: [fullCard('angle-copy')], same_story_total: 1 }],
      center_same_story: [fullCard('center-copy-1'), fullCard('center-copy-2')],
      center_same_story_total: 5,
      selection: selection('insufficient', 1),
    });
  };
  const result = await adapter.fetchAndCacheNewsMap('center', 'test');
  assert.deepEqual(result.relatedNewsIds, ['angle']);
  assert.equal(result.sameStory, undefined);
  assert.equal(result.sameStoryTotals, undefined);
  assert.equal(result.mapSelection.status, 'insufficient');
  for (const id of ['angle-copy', 'center-copy-1']) assert.equal(adapter.findKnownNews(id), undefined);
  const cached = adapter.findKnownNews('angle');
  assert.equal(cached.title, 'HBM 생산 확대');
  assert.equal(cached.source, 'publisher.test');
  assert.ok(cached.sourceUrl.endsWith('angle') && cached.publishedAt.includes('2026'));
  assert.equal(cached.imageUrl, 'https://publisher.test/news.jpg');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('expand=true'));
});

test('initial request is expandable, expansion keeps visible nodes and appends', async () => {
  cluster();
  let finish;
  globalThis.fetch = async (url) => String(url).includes('expand=false')
    ? ok({ related_news: [fullCard('first')], selection: selection('expandable', 1) })
    : new Promise((resolve) => { finish = resolve; });
  const first = await adapter.fetchAndCacheNewsMap('center', 'test', 6, { expand: false });
  assert.equal(first.mapSelection.status, 'expandable');
  const expanding = adapter.fetchAndCacheNewsMap('center', 'test', 6, { expand: true, keep: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(adapter.resolveCluster('test').relatedNewsIds, ['first']); // Not cleared while waiting.
  finish(ok({ related_news: [fullCard('first'), fullCard('second')], selection: selection('complete', 2, 2) }));
  const full = await expanding;
  assert.deepEqual(full.relatedNewsIds, ['first', 'second']);
  assert.equal(full.mapSelection.status, 'complete');
});

test('a different center clears the previous map, and a late expansion cannot overwrite it', async () => {
  cluster();
  let finishOld;
  globalThis.fetch = async (url) => String(url).includes('/old-center/')
    ? new Promise((resolve) => { finishOld = resolve; })
    : ok({ related_news: [fullCard('new-neighbour')], selection: selection('insufficient', 1) });
  adapter.dynClusters.set('test', { ...adapter.resolveCluster('test'), mainNewsId: 'old-center',
    relatedNewsIds: ['old-first'] });
  const late = adapter.fetchAndCacheNewsMap('old-center', 'test', 6, { expand: true, keep: true });
  await adapter.fetchAndCacheNewsMap('new-center', 'test');
  finishOld(ok({ related_news: [fullCard('old-second')], selection: selection('complete', 3) }));
  await late;
  const current = adapter.resolveCluster('test');
  assert.equal(current.mainNewsId, 'new-center');
  assert.deepEqual(current.relatedNewsIds, ['new-neighbour']);
  assert.equal(current.sameStory, undefined);
});

test('failed expansion keeps the valid first result but marks the map partial', async () => {
  cluster();
  globalThis.fetch = async () => ok({ related_news: [fullCard('first')], selection: selection('expandable', 1) });
  await adapter.fetchAndCacheNewsMap('center', 'test', 6, { expand: false });
  const partial = adapter.markNewsMapPartial('center', 'test', 'request_failed');
  assert.deepEqual(partial.relatedNewsIds, ['first']);
  assert.equal(partial.mapSelection.status, 'partial');
  // A stale failure for another center changes nothing.
  assert.equal(adapter.markNewsMapPartial('other', 'test', 'request_failed').mapSelection.status, 'partial');
  adapter.dynClusters.set('test', { ...partial, mapSelection: selection('complete', 3) });
  assert.equal(adapter.markNewsMapPartial('center', 'test', 'x').mapSelection.status, 'complete');
});

test('status separates loading, finding more, error, partial, shortage and complete', () => {
  const render = (props) => renderToStaticMarkup(createElement(NewsMapStatus, { count: 1, pending: false, error: null, ...props }));
  assert.equal(render({ pending: true, findingMore: true }), '');
  assert.ok(render({ findingMore: true }).includes('추가 관련 기사를 찾는 중'));
  assert.ok(render({ error: '연관 기사를 불러오지 못했습니다.' }).includes('role="alert"'));
  const partial = render({ selection: { ...selection('partial', 1), reason: 'timeout' } });
  assert.ok(partial.includes('is-warning') && partial.includes('확인된 1개'));
  const shortage = render({ selection: selection('insufficient', 1), grouped: 4 });
  assert.ok(shortage.includes('연관 기사 1개') && !shortage.includes('같은 소식'));
  assert.equal(render({ count: 3, selection: selection('complete', 3) }), '');
  assert.ok(render({ count: 3, selection: selection('insufficient', 3, 10) }).includes('연관 기사 3개'));
});

test('map renders normal nodes and detail actions without legacy grouping badges', () => {
  const news = (id) => ({ id, title: `${id} 제목`, source: '출처', publishedAt: '2026-10-02 09:00', summary: '',
    mockOriginalBody: '', thumbnailTone: 'oil', imageUrl: '', keywords: [], relatedStockSymbols: [], sentiment: 'neutral' });
  const markup = renderToStaticMarkup(createElement(NewsMapCanvas, {
    centerNews: news('center'), relatedNews: [news('a'), news('b')],
    // Older callers/cached data may contain these fields. The canvas ignores them.
    storyCounts: { center: 5, a: 2 }, onOpenStory: () => undefined,
    onOpenDetail: () => undefined, onFocusNews: () => undefined,
  }));
  for (const text of ['center 제목', 'a 제목', 'b 제목', '출처', '상세 보기', '맵 중심으로 이동']) {
    assert.ok(markup.includes(text), text);
  }
  assert.ok(!markup.includes('같은 소식') && !markup.includes('node-story-chip') && !markup.includes('story-panel'));
});
