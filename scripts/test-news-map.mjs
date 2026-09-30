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
