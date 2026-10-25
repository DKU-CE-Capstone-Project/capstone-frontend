import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { after, beforeEach, test } from 'node:test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dir = await mkdtemp(join(tmpdir(), 'econmind-v2-'));
await build({
  entryPoints: ['src/data/newsMapService.ts', 'src/layout/newsTree.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: dir,
  outbase: 'src',
  define: { 'import.meta.env': '{}' },
});
const api = await import(pathToFileURL(join(dir, 'data/newsMapService.js')));
const tree = await import(pathToFileURL(join(dir, 'layout/newsTree.js')));
const mockDir = await mkdtemp(join(tmpdir(), 'econmind-v2-mock-'));
await build({
  entryPoints: ['src/data/newsMapService.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: mockDir,
  define: { 'import.meta.env': '{"VITE_NEWS_MAP_SOURCE":"mock"}' },
});
const mockApi = await import(pathToFileURL(join(mockDir, 'newsMapService.js')));
const viewDir = await mkdtemp(join(process.cwd(), 'node_modules', '.econmind-v2-view-'));
await build({
  entryPoints: [
    'src/components/NewsMapExplorer.tsx',
    'src/components/KeywordMap.tsx',
    'src/layout/mapLayout.ts',
  ],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: viewDir,
  outbase: 'src',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'lucide-react', 'motion/react'],
  define: { 'import.meta.env': '{}' },
});
const { NewsMapExplorer, geometry: explorerGeometry } = await import(pathToFileURL(join(viewDir, 'components/NewsMapExplorer.js')));
const { KeywordMap } = await import(pathToFileURL(join(viewDir, 'components/KeywordMap.js')));
const mapLayout = await import(pathToFileURL(join(viewDir, 'layout/mapLayout.js')));
const originalFetch = globalThis.fetch;
let store;
let calls;
let activeControllers = [];
const controller = (map) => {
  const c = new api.NewsMapController(api.mapFromApi(map, session));
  activeControllers.push(c);
  return c;
};
const session = {
  session_epoch: 'epoch',
  resumed: true,
  expires_at: '2026-10-12T00:00:00Z',
  prototype_tier: 'FREE',
  capabilities: {
    max_report_articles: 1,
    initial_related_target: 4,
    branch_related_target: 3,
    max_map_nodes: 40,
    max_map_depth: 4,
  },
};
const card = (id) => ({
  news_id: id,
  title: `title-${id}`,
  description: `description-${id}`,
  source_name: 'fixture.test',
  source_url: `https://fixture.test/${id}`,
  thumbnail_url: null,
  published_at: '2026-10-11T00:00:00Z',
  keywords: ['keyword'],
  categories: ['category'],
});
const selection = (n = 4) => ({
  status: n < 4 ? 'insufficient' : 'complete',
  requested: 4,
  returned: n,
  shortage: n < 4,
  reason: n < 4 ? 'no_eligible_related' : null,
  budget_exhausted: false,
});
const map = (overrides = {}) => ({
  map_id: 'map',
  revision: 1,
  query: 'query',
  state: 'active',
  root_node_id: 'server-root',
  nodes: ['a', 'diverse', 'higher', 'd', 'e'].map((id, i) => ({
    node_id: i ? `server-${id}` : 'server-root',
    news_id: id,
    parent_node_id: i ? 'server-root' : null,
    level: i ? 1 : 0,
    expanded: !i,
    batch: 0,
    news: card(id),
  })),
  branches: [
    {
      parent_node_id: 'server-root',
      child_node_ids: [
        'server-diverse',
        'server-higher',
        'server-d',
        'server-e',
      ],
      display_selection: selection(),
      last_attempt: selection(),
    },
  ],
  initial_selection: selection(),
  selected_news_ids: [],
  detail_news_id: null,
  report_panel_open: false,
  active_report_job_id: null,
  last_result: null,
  expires_at: session.expires_at,
  ...overrides,
});
const job = (overrides = {}) => ({
  job_id: 'job',
  client_request_id: 'request',
  map_id: 'map',
  accepted_map_revision: 3,
  status: 'running',
  stage: 'extracting',
  request_news_ids: ['a'],
  progress: { requested: 1, processed: 0, succeeded: 0, failed: 0 },
  result: null,
  warnings: [],
  error: null,
  created_at: '2026-10-11T00:00:00Z',
  updated_at: '2026-10-11T00:00:00Z',
  expires_at: session.expires_at,
  ...overrides,
});
const report = (overrides = {}) => ({
  schema_version: 2,
  report_id: 'report',
  title: 'real contract fixture',
  event_summary: 'summary',
  event_analysis: 'analysis',
  market_impact: 'impact',
  stock_impacts: [
    {
      ticker: null,
      name: 'Unverified company',
      impact: 'unknown',
      direction: 'unknown',
      evidence_news_ids: ['a'],
    },
  ],
  risk_factors: ['risk'],
  requested_news_ids: ['a'],
  used_evidence: [
    {
      news_id: 'a',
      title: 'a',
      source_name: 'source',
      source_url: 'https://fixture.test/a',
      published_at: null,
      body_id: 'body',
      content_hash: 'a'.repeat(64),
      input_char_count: 5,
      truncated: true,
    },
  ],
  failed_evidence: [],
  coverage: { requested_count: 1, used_count: 1, failed_count: 0 },
  rag_evidence: [],
  verification: { status: 'unavailable', notes: ['critic unavailable'] },
  created_at: '2026-10-11T00:00:00Z',
  ...overrides,
});
const response = (data, status = 200, headers = {}) => ({
  ok: status < 400,
  status,
  headers: new Headers(headers),
  json: async () => structuredClone(data),
});
function server(fn) {
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    const call = {
      path: parsed.pathname.replace('/api/v2', ''),
      search: parsed.search,
      method: options.method,
      body: options.body ? JSON.parse(options.body) : undefined,
      options,
    };
    calls.push(call);
    return fn(call);
  };
}
async function until(predicate) {
  for (let n = 0; n < 100; n++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail('condition did not settle');
}
beforeEach(() => {
  for (const c of activeControllers) c.setVisible(false);
  activeControllers = [];
  calls = [];
  store = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
});
after(async () => {
  for (const c of activeControllers) c.setVisible(false);
  globalThis.fetch = originalFetch;
  delete globalThis.sessionStorage;
  await rm(dir, { recursive: true, force: true });
  await rm(mockDir, { recursive: true, force: true });
  await rm(viewDir, { recursive: true, force: true });
});

test('API thumbnails reach news-map card and detail images without substituting unrelated photos', () => {
  const m = map();
  const rootImage = 'https://publisher.test/root-photo.jpg';
  const childImage = 'https://publisher.test/child-photo.jpg';
  m.nodes[0].news.thumbnail_url = rootImage;
  m.nodes[1].news.thumbnail_url = childImage;
  const html = renderToStaticMarkup(createElement(NewsMapExplorer, {
    map: api.mapFromApi(m, session),
    onExpired() {},
    onMap() {},
    onChrome() {},
  }));
  const images = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(images, [rootImage, childImage, rootImage]);
  // Cached images can complete before React attaches onLoad. Their visibility
  // must not depend on another load event after map/report restoration.
  assert.doesNotMatch(html, /<img\b[^>]*style="[^"]*opacity:\s*0(?:;|")/);
  assert.doesNotMatch(html, /images\.unsplash\.com/);
});

test('v2 requests include cookies, omit JS session secrets, and preserve server MMR order', async () => {
  server((c) =>
    response(
      c.path === '/session' ? session : map(),
      c.path === '/maps' ? 201 : 200,
    ),
  );
  const result = await api.fetchNewsMap('  query  ');
  assert.deepEqual(
    result.related.map((n) => n.id),
    ['diverse', 'higher', 'd', 'e'],
  );
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/session', '/maps'],
  );
  assert.deepEqual(calls[1].body, { query: 'query' });
  assert.ok(calls.every((c) => c.options.credentials === 'include'));
  assert.deepEqual(JSON.parse([...store.values()][0]), {
    session_epoch: 'epoch',
    map_id: 'map',
  });
  assert.equal(
    JSON.stringify([...store.values()]).includes('session_id'),
    false,
  );
});
test('429 during session lookup preserves Retry-After and does not start a map mutation', async () => {
  server(() => response(
    { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'quota full', retryable: true, details: {} } },
    429,
    { 'Retry-After': '75' },
  ));
  await assert.rejects(api.fetchNewsMap('query'), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterSeconds, 75);
    assert.match(error.message, /요청 한도.*약 75초 후/);
    return true;
  });
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [['GET', '/session']]);
});
test('429 from map creation tells the user to wait without retrying the POST', async () => {
  server((call) => call.path === '/session'
    ? response(session)
    : response(
        { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'quota full', retryable: true, details: {} } },
        429,
        { 'Retry-After': '31' },
      ));
  await assert.rejects(api.fetchNewsMap('query'), (error) => {
    assert.equal(error.retryAfterSeconds, 31);
    assert.match(error.message, /요청 한도.*약 31초 후/);
    return true;
  });
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ['GET', '/session'], ['POST', '/maps'],
  ]);
});
test('home recommendations stay offline and mock mode keeps keyword maps offline', async () => {
  server(() => assert.fail('home recommendations and mock mode must not call live API'));
  assert.ok((await api.fetchRecommendedKeywords()).length);
  assert.ok((await mockApi.fetchKeywordMap('환율')).keywords.includes('환율'));
});
test('fetchKeywordMap calls /api/v1/keywords/map, preserves grounded nodes, and surfaces 429 Retry-After', async () => {
  await assert.rejects(api.fetchKeywordMap('   '), (error) => {
    assert.equal(error.status, 422);
    return true;
  });
  assert.equal(calls.length, 0);

  const fixture = {
    query: '반도체',
    total_articles: 38,
    keywords: ['반도체', 'HBM 공급 협상', '파운드리 수율 개선', '삼성전자', 'SK하이닉스'],
    nodes: [
      {
        keyword: '반도체',
        kind: 'center',
        article_count: 38,
        search_query: '반도체',
        center_news_id: 'n-1',
        news_ids: ['n-1', 'n-2'],
      },
      {
        keyword: 'HBM 공급 협상',
        kind: 'issue',
        article_count: 14,
        search_query: '반도체 HBM 공급 협상',
        center_news_id: 'n-2',
        news_ids: ['n-2', 'n-3'],
      },
      {
        keyword: '파운드리 수율 개선',
        kind: 'issue',
        article_count: 9,
        search_query: '반도체 파운드리 수율 개선',
        center_news_id: 'n-4',
        news_ids: ['n-4'],
      },
      {
        keyword: '삼성전자',
        kind: 'entity',
        article_count: 18,
        search_query: '반도체 삼성전자',
        center_news_id: 'n-1',
        news_ids: ['n-1'],
      },
      {
        keyword: 'SK하이닉스',
        kind: 'entity',
        article_count: 11,
        search_query: '반도체 SK하이닉스',
        center_news_id: 'n-2',
        news_ids: ['n-2'],
      },
    ],
  };
  server(() => response(fixture));
  const result = await api.fetchKeywordMap('  반도체  ');
  assert.equal(result.query, '반도체');
  assert.deepEqual(result.keywords, fixture.keywords);
  assert.equal(result.nodes.length, 5);
  assert.deepEqual(calls.map((c) => [c.method, c.path, c.search]), [
    ['GET', '/api/v1/keywords/map', '?q=%EB%B0%98%EB%8F%84%EC%B2%B4'],
  ]);
  assert.equal(calls[0].options.credentials, 'include');

  calls = [];
  server(() => response({ detail: '요청이 너무 많습니다.' }, 429, { 'Retry-After': '19' }));
  await assert.rejects(api.fetchKeywordMap('반도체'), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.retryAfterSeconds, 19);
    return true;
  });
});
test('KeywordMap keeps issue nodes on inner ring and entity nodes on outer ring even with <4 issues', () => {
  const nodes = [
    { keyword: '환율', kind: 'center', article_count: 30, search_query: '환율' },
    { keyword: '외환당국 구두개입', kind: 'issue', article_count: 12, search_query: '환율 외환당국 구두개입' },
    { keyword: '수입물가 상승 압력', kind: 'issue', article_count: 7, search_query: '환율 수입물가 상승 압력' },
    { keyword: '한국은행', kind: 'entity', article_count: 15, search_query: '환율 한국은행' },
    { keyword: '기획재정부', kind: 'entity', article_count: 8, search_query: '환율 기획재정부' },
    { keyword: '연준', kind: 'entity', article_count: 5, search_query: '환율 연준' },
  ];
  const keywords = nodes.map((n) => n.keyword);
  const placed = mapLayout.layoutKeywordMap(keywords, mapLayout.KEYWORD_PROFILE_FULL, nodes);
  assert.equal(placed.length, 6);
  assert.equal(placed[0].size, mapLayout.KEYWORD_PROFILE_FULL.center.size);
  for (const issueNode of placed.filter((n) => n.kind === 'issue')) {
    assert.equal(issueNode.size, mapLayout.KEYWORD_PROFILE_FULL.inner.size);
  }
  for (const entityNode of placed.filter((n) => n.kind === 'entity')) {
    assert.equal(entityNode.size, mapLayout.KEYWORD_PROFILE_FULL.outer.size);
  }
  assert.equal(placed[1].searchQuery, '환율 외환당국 구두개입');

  // Legacy positional fallback remains intact when nodeMetas is omitted.
  const legacy = mapLayout.layoutKeywordMap(keywords, mapLayout.KEYWORD_PROFILE_FULL);
  assert.equal(legacy[3].size, mapLayout.KEYWORD_PROFILE_FULL.inner.size);
  assert.equal(legacy[5].size, mapLayout.KEYWORD_PROFILE_FULL.outer.size);

  const html = renderToStaticMarkup(
    createElement(KeywordMap, {
      keywords,
      nodes,
      onSelect() {},
    }),
  );
  assert.match(html, /is-issue/);
  assert.match(html, /is-entity/);
  assert.match(html, /12건/);
  assert.match(html, /15건/);
  assert.doesNotMatch(html, /30건/);
});
test('KeywordMap nodes stay within field bounds without clipping or overlapping search strip', async () => {
  const { readFile } = await import('node:fs/promises');
  const fullNodes = [
    { keyword: '반도체', kind: 'center', article_count: 37 },
    { keyword: '솔리다임 상장검토 중단', kind: 'issue', article_count: 8 },
    { keyword: '산단 인허가·보상·설계', kind: 'issue', article_count: 6 },
    { keyword: '이건희 선대회장 6주기', kind: 'issue', article_count: 6 },
    { keyword: 'AI·반도체주 급락', kind: 'issue', article_count: 5 },
    { keyword: 'SK하이닉스', kind: 'entity', article_count: 14 },
    { keyword: '개인정보보호위원회', kind: 'entity', article_count: 4 },
    { keyword: '필라델피아 반도체지수', kind: 'entity', article_count: 4 },
    { keyword: '삼성전자', kind: 'entity', article_count: 14 },
  ];
  const keywords = fullNodes.map((n) => n.keyword);

  for (const profile of [mapLayout.KEYWORD_PROFILE_FULL, mapLayout.KEYWORD_PROFILE_MOBILE]) {
    const placed = mapLayout.layoutKeywordMap(keywords, profile, fullNodes);
    assert.equal(placed.length, 9);
    for (let i = 0; i < placed.length; i++) {
      const a = placed[i];
      const hoverRadius = (a.size / 2) * 1.08 + 5;
      assert.ok(a.x - hoverRadius >= 0, `node ${a.keyword} left edge clipped`);
      assert.ok(a.x + hoverRadius <= profile.field.width, `node ${a.keyword} right edge clipped`);
      assert.ok(a.y - hoverRadius >= 0, `node ${a.keyword} top edge clipped`);
      assert.ok(a.y + hoverRadius <= profile.field.height, `node ${a.keyword} bottom edge clipped`);
      for (let j = i + 1; j < placed.length; j++) {
        const b = placed[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(dist > (a.size + b.size) / 2 + 8, `nodes ${a.keyword} and ${b.keyword} overlap`);
      }
    }
    const longCompound = placed.find((n) => n.keyword === '개인정보보호위원회');
    assert.ok(longCompound.fontSize < profile.outer.fontSize);
  }

  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  const resultsRule = css.match(/\.results-view\s*\{[^}]*padding:\s*(\d+)px\s+[^\s;]+\s+(\d+)px/s);
  assert.ok(resultsRule, '.results-view padding rule exists');
  // Header ends at 62px (top 24 + height 38); search strip top is 152px from bottom (bottom 104 + height 48).
  assert.ok(Number(resultsRule[1]) >= 68, 'top padding clears header bar');
  assert.ok(Number(resultsRule[2]) >= 160, 'bottom padding clears .result-search-strip');
  assert.match(css, /\.orbit-field\s*\{[^}]*overflow:\s*visible/s);
  assert.match(css, /\.keyword-node\s*\{[^}]*overflow-wrap:\s*break-word/s);
});
test('same-tab refresh restores map using GET only and coalesces StrictMode setup', async () => {
  api.rememberMap(api.mapFromApi(map(), session));
  server((c) => response(c.path === '/session' ? session : map()));
  const [a, b] = await Promise.all([
    api.restoreNewsMap(),
    api.restoreNewsMap(),
  ]);
  assert.equal(a.map_id, b.map_id);
  assert.deepEqual(
    calls.map((c) => c.method),
    ['GET', 'GET'],
  );
});
test('new session epoch discards old navigation without guessing resource ownership', async () => {
  api.rememberMap(api.mapFromApi(map(), session));
  server(() => response({ ...session, session_epoch: 'new', resumed: false }));
  assert.equal(await api.restoreNewsMap(), null);
  assert.equal(store.size, 0);
  assert.equal(calls.length, 1);
});
test('deleting old keyword map preserves the newly saved map reference', async () => {
  api.rememberMap(api.mapFromApi(map({ map_id: 'new' }), session));
  server(() => response(undefined, 204));
  await api.deleteMap(api.mapFromApi(map(), session));
  assert.equal(JSON.parse([...store.values()][0]).map_id, 'new');
});
test('empty search map remains empty and never borrows mock articles', async () => {
  const empty = map({
    nodes: [],
    branches: [],
    root_node_id: null,
    state: 'empty',
    initial_selection: selection(0),
  });
  server((c) => response(c.path === '/session' ? session : empty));
  const result = await api.fetchNewsMap('empty');
  assert.equal(result.root, null);
  assert.deepEqual(result.related, []);
  assert.match(api.selectionMessage(result.initial_selection), /부족/);
});
test('FREE selection replaces one article and toggles it off with server revision', async () => {
  let m = map({ selected_news_ids: ['a'] });
  const c = controller(m);
  server((call) => {
    assert.equal(call.body.expected_revision, m.revision);
    m = { ...m, ...call.body, revision: m.revision + 1 };
    return response(m);
  });
  await c.select('diverse');
  assert.deepEqual(c.state.map.selected_news_ids, ['diverse']);
  await c.select('diverse');
  assert.deepEqual(c.state.map.selected_news_ids, []);
  assert.equal(
    calls.some((c) => 'tier' in c.body),
    false,
  );
});
test('PAID selection honors server ten-article capability and rejects eleventh without truncation', async () => {
  const m = map({
    selected_news_ids: Array.from({ length: 10 }, (_, i) => `id${i}`),
  });
  const c = new api.NewsMapController(
    api.mapFromApi(m, {
      ...session,
      prototype_tier: 'PAID',
      capabilities: { ...session.capabilities, max_report_articles: 10 },
    }),
  );
  activeControllers.push(c);
  server(() => assert.fail('over-limit must not send a truncated list'));
  await assert.rejects(c.select('eleventh'), /10/);
  assert.equal(c.state.map.selected_news_ids.length, 10);
});
test('concurrent card actions serialize revisions instead of dropping the second selection', async () => {
  let m = map();
  const c = controller(m);
  server((call) => {
    assert.equal(call.body.expected_revision, m.revision);
    m = { ...m, ...call.body, revision: m.revision + 1 };
    return response(m);
  });
  await Promise.all([c.select('a'), c.select('d')]);
  assert.deepEqual(c.state.map.selected_news_ids, ['d']);
  assert.deepEqual(
    calls.map((c) => c.body.expected_revision),
    [1, 2],
  );
});
test('revision conflict reloads current map and preserves explicit error', async () => {
  const c = controller(map());
  server((call) =>
    call.method === 'PATCH'
      ? response(
          {
            error: {
              code: 'MAP_REVISION_CONFLICT',
              message: 'revision changed',
              retryable: false,
              details: { revision: 7 },
            },
          },
          409,
        )
      : response(map({ revision: 7, selected_news_ids: ['e'] })),
  );
  await assert.rejects(c.select('a'), /revision changed/);
  assert.equal(c.state.map.revision, 7);
  assert.deepEqual(c.state.map.selected_news_ids, ['e']);
  assert.equal(c.state.error, 'revision changed');
});
test('research zero returns same branch and selected evidence; caller sends node ID and revision only', async () => {
  const m = map({ selected_news_ids: ['diverse'] });
  const c = controller(m);
  server((call) => {
    assert.deepEqual(call.body, {
      expected_revision: 1,
      parent_node_id: 'server-root',
      mode: 'research',
    });
    return response({
      ...m,
      revision: 2,
      branches: [{ ...m.branches[0], last_attempt: selection(0) }],
    });
  });
  await c.branch('server-root', 'research');
  assert.deepEqual(c.state.map.selected_news_ids, ['diverse']);
  assert.deepEqual(c.state.map.nodes, m.nodes);
  assert.equal(c.state.map.branches[0].last_attempt.returned, 0);
});
test('branch failures preserve valid displayed tree rather than hiding errors as shortage', async () => {
  const c = controller(map());
  server(() =>
    response(
      {
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'search failed',
          retryable: true,
          details: {},
        },
      },
      503,
    ),
  );
  await assert.rejects(c.branch('server-d', 'expand'), /search failed/);
  assert.equal(c.state.map.nodes.length, 5);
  assert.equal(c.state.error, 'search failed');
});
test('429 from branch expansion keeps the tree, shows the wait, and never retries POST', async () => {
  const c = controller(map());
  server(() => response(
    { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'quota full', retryable: true, details: {} } },
    429,
    { 'Retry-After': '12' },
  ));
  await assert.rejects(c.branch('server-d', 'expand'), /약 12초 후/);
  assert.equal(c.state.map.nodes.length, 5);
  assert.match(c.state.error, /요청 한도.*약 12초 후/);
  assert.deepEqual(calls.map((call) => [call.method, call.path]), [
    ['POST', '/maps/map/branches'],
  ]);
});
test('new report sends real selected IDs, idempotency UUID and updated revision, never adds center', async () => {
  let m = map({ selected_news_ids: ['d'] });
  const c = controller(m);
  let rejectJob;
  server((call) => {
    if (call.method === 'PATCH') {
      m = { ...m, ...call.body, revision: m.revision + 1 };
      return response(m);
    }
    if (call.method === 'POST') {
      assert.deepEqual(call.body.news_ids, ['d']);
      assert.equal(call.body.expected_revision, 2);
      assert.match(call.options.headers['Idempotency-Key'], /^[\da-f-]{36}$/);
      assert.equal('tier' in call.body, false);
      return response(
        job({ accepted_map_revision: 3, request_news_ids: ['d'] }),
        202,
      );
    }
    return new Promise((resolve) => {
      rejectJob = resolve;
    });
  });
  await c.openReport();
  assert.equal(c.state.map.revision, 3);
  assert.equal(c.state.map.active_report_job_id, 'job');
  c.setVisible(false);
  rejectJob?.(response(job()));
});
test('transport retry reuses exact body and idempotency key', async () => {
  const c = controller(
    map({ selected_news_ids: ['a'], report_panel_open: true }),
  );
  let attempts = 0;
  server((call) => {
    if (call.method === 'POST') {
      if (++attempts === 1) throw new TypeError('lost response');
      return response(job(), 202);
    }
    return new Promise(() => {});
  });
  await c.openReport();
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 2);
  assert.deepEqual(posts[0].body, posts[1].body);
  assert.equal(
    posts[0].options.headers['Idempotency-Key'],
    posts[1].options.headers['Idempotency-Key'],
  );
});
test('dependency retry after dispatch failure retains request key across user retries', async () => {
  const c = controller(
    map({ selected_news_ids: ['a'], report_panel_open: true }),
  );
  let attempts = 0;
  server((call) => {
    if (call.method === 'POST')
      return ++attempts === 1
        ? response(
            {
              error: {
                code: 'DEPENDENCY_UNAVAILABLE',
                message: 'publish failed',
                retryable: true,
                details: {},
              },
            },
            503,
          )
        : response(job(), 202);
    return new Promise(() => {});
  });
  await assert.rejects(c.openReport(), /publish failed/);
  await c.retryReport();
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(
    posts[0].options.headers['Idempotency-Key'],
    posts[1].options.headers['Idempotency-Key'],
  );
  assert.deepEqual(posts[0].body, posts[1].body);
});
test('manual retry after a 429 uses the current map revision if the map changed', async () => {
  const c = controller(map({ selected_news_ids: ['a'], report_panel_open: true }));
  let posts = 0;
  server((call) => {
    if (call.method === 'PATCH')
      return response({ ...c.state.map, ...call.body, revision: c.state.map.revision + 1 });
    if (call.method === 'POST')
      return ++posts === 1
        ? response(
            { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'quota full', retryable: true, details: {} } },
            429,
            { 'Retry-After': '20' },
          )
        : response(job({ accepted_map_revision: 3 }), 202);
    return new Promise(() => {});
  });
  await assert.rejects(c.openReport(), /약 20초 후/);
  assert.equal(posts, 1);
  await c.update({ detail_news_id: 'a' });
  await c.retryReport();
  const sent = calls.filter((call) => call.method === 'POST');
  assert.deepEqual(sent.map((call) => call.body.expected_revision), [1, 2]);
  assert.notEqual(sent[0].options.headers['Idempotency-Key'], sent[1].options.headers['Idempotency-Key']);
  assert.equal(c.state.map.active_report_job_id, 'job');
});
test('refresh of running report polls existing job and publishes no duplicate POST', async () => {
  const c = controller(
    map({
      selected_news_ids: ['a'],
      report_panel_open: true,
      active_report_job_id: 'job',
    }),
  );
  server(() =>
    response(
      job({
        progress: { requested: 1, processed: 1, succeeded: 0, failed: 1 },
        stage: 'verifying',
      }),
    ),
  );
  c.setVisible(true);
  await until(() => c.state.job);
  assert.equal(c.state.job.stage, 'verifying');
  assert.deepEqual(c.state.job.progress, {
    requested: 1,
    processed: 1,
    succeeded: 0,
    failed: 1,
  });
  assert.ok(calls.every((c) => c.method === 'GET'));
});
test('late job completion cannot overwrite the replacement evidence after selection PATCH', async () => {
  let finish;
  let m = map({
    selected_news_ids: ['a'],
    report_panel_open: true,
    active_report_job_id: 'job',
  });
  const c = controller(m);
  server((call) => {
    if (call.path === '/report-jobs/job')
      return new Promise((resolve) => {
        finish = resolve;
      });
    if (call.method === 'PATCH') {
      m = {
        ...m,
        ...call.body,
        revision: 2,
        active_report_job_id: null,
        last_result: null,
      };
      return response(m);
    }
    if (call.method === 'POST')
      return response(
        job({
          job_id: 'new-job',
          request_news_ids: ['d'],
          accepted_map_revision: 3,
        }),
        202,
      );
    return new Promise(() => {});
  });
  c.setVisible(true);
  await until(() => finish);
  await c.select('d');
  finish(
    response(
      job({
        status: 'completed',
        stage: 'done',
        result: {
          report_id: 'old-report',
          strategy_id: null,
          report_reused: false,
          strategy_reused: false,
        },
      }),
    ),
  );
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(c.state.map.active_report_job_id, 'new-job');
  assert.equal(c.state.report, null);
  assert.equal(
    calls.some((c) => c.path === '/reports/old-report'),
    false,
  );
});
test('completed report refreshes map before loading result and keeps partial failure/critic evidence', async () => {
  const m = map({
    selected_news_ids: ['a', 'd'],
    report_panel_open: true,
    active_report_job_id: 'job',
  });
  const c = controller(m);
  const result = {
    report_id: 'report',
    strategy_id: null,
    report_reused: false,
    strategy_reused: false,
  };
  server((call) =>
    response(
      call.path.startsWith('/report-jobs')
        ? job({
            status: 'completed',
            stage: 'done',
            request_news_ids: ['a', 'd'],
            progress: { requested: 2, processed: 2, succeeded: 1, failed: 1 },
            result,
            warnings: ['PARTIAL_EVIDENCE', 'STRATEGY_GENERATION_FAILED'],
          })
        : call.path.startsWith('/maps')
          ? {
              ...m,
              revision: 4,
              active_report_job_id: null,
              last_result: { report_id: 'report', strategy_id: null },
            }
          : report({
              requested_news_ids: ['a', 'd'],
              failed_evidence: [
                {
                  news_id: 'd',
                  code: 'EXTRACTION_TIMEOUT',
                  message: 'timeout',
                  retryable: true,
                },
              ],
              coverage: { requested_count: 2, used_count: 1, failed_count: 1 },
            }),
    ),
  );
  c.setVisible(true);
  await until(() => c.state.report);
  assert.deepEqual(
    calls.map((c) => c.path),
    ['/report-jobs/job', '/maps/map', '/reports/report'],
  );
  assert.equal(c.state.report.coverage.failed_count, 1);
  assert.equal(c.state.report.verification.status, 'unavailable');
  assert.equal(c.state.report.strategySummary, null);
  assert.equal(c.state.report.stockImpacts[0].direction, 'unknown');
});
test('failed jobs never fetch or fabricate completed reports', async () => {
  const m = map({
    selected_news_ids: ['a'],
    report_panel_open: true,
    active_report_job_id: 'job',
  });
  const c = controller(m);
  server((call) =>
    response(
      call.path.startsWith('/report-jobs')
        ? job({
            status: 'failed',
            stage: 'done',
            error: {
              code: 'NO_USABLE_EVIDENCE',
              message: 'all bodies failed',
              retryable: true,
              details: {},
            },
          })
        : { ...m, revision: 2, active_report_job_id: null },
    ),
  );
  c.setVisible(true);
  await until(() => c.state.error);
  assert.equal(c.state.report, null);
  assert.equal(
    calls.some((c) => c.path.startsWith('/reports')),
    false,
  );
  assert.equal(c.state.error, 'all bodies failed');
});
test('expired job loads valid map last_result without automatic new generation', async () => {
  const m = map({
    selected_news_ids: ['a'],
    report_panel_open: true,
    active_report_job_id: 'job',
  });
  const c = controller(m);
  server((call) =>
    call.path.startsWith('/report-jobs')
      ? response(
          {
            error: {
              code: 'RESOURCE_EXPIRED',
              message: 'expired job',
              retryable: false,
              details: {},
            },
          },
          410,
        )
      : response(
          call.path.startsWith('/maps')
            ? {
                ...m,
                revision: 4,
                active_report_job_id: null,
                last_result: { report_id: 'report', strategy_id: null },
              }
            : report(),
        ),
  );
  c.setVisible(true);
  await until(() => c.state.report);
  assert.ok(calls.every((c) => c.method === 'GET'));
  assert.equal(c.state.expired, false);
});
test('closing report only updates panel and stops polling without sending cancellation', async () => {
  const m = map({
    selected_news_ids: ['a'],
    report_panel_open: true,
    active_report_job_id: 'job',
  });
  const c = controller(m);
  server((call) => response({ ...m, ...call.body, revision: 2 }));
  c.setVisible(false);
  await c.update({ report_panel_open: false });
  assert.equal(c.state.map.active_report_job_id, 'job');
  assert.deepEqual(
    calls.map((c) => c.method),
    ['PATCH'],
  );
});
test('explicit cancellation uses cancel endpoint and exposes server cancellation state', async () => {
  const c = controller(
    map({
      selected_news_ids: ['a'],
      report_panel_open: true,
      active_report_job_id: 'job',
    }),
  );
  server((call) => {
    assert.equal(call.path, '/report-jobs/job/cancel');
    return response(job({ status: 'cancel_requested' }));
  });
  await c.cancel();
  assert.equal(c.state.job.status, 'cancel_requested');
});
test('reset uses server expected revision and server-issued child IDs', async () => {
  const c = controller(map({ revision: 7, selected_news_ids: ['a'] }));
  const fresh = map({
    revision: 8,
    nodes: map().nodes.map((n, i) => ({
      ...n,
      node_id: i ? `new-${i}` : n.node_id,
    })),
    branches: [],
  });
  server((call) => {
    assert.deepEqual(call.body, { expected_revision: 7 });
    assert.equal(call.path, '/maps/map/reset');
    return response(fresh);
  });
  await c.reset();
  assert.equal(c.state.map.nodes[1].node_id, 'new-1');
  assert.deepEqual(c.state.map.selected_news_ids, []);
});
test('server tree restores deeper topology and selected-card identity while keeping only coordinates local', () => {
  const m = map();
  m.nodes.push({
    node_id: 'deep',
    news_id: 'child',
    parent_node_id: 'server-diverse',
    level: 2,
    expanded: false,
    batch: 0,
    news: card('child'),
  });
  m.nodes[1].expanded = true;
  m.branches.push({
    parent_node_id: 'server-diverse',
    child_node_ids: ['deep'],
    display_selection: selection(1),
    last_attempt: selection(1),
  });
  const first = tree.treeFromMap(api.mapFromApi(m, session));
  assert.equal(first.nodes['v2:deep'].parent, 'v2:server-diverse');
  assert.equal(first.nodes.root.news.id, 'a');
  first.nodes['v2:deep'].x = 123;
  const restored = tree.treeFromMap(api.mapFromApi(m, session), first);
  assert.equal(restored.nodes['v2:deep'].x, 123);
  assert.deepEqual(restored.order, [
    'root',
    'v2:server-diverse',
    'v2:server-higher',
    'v2:server-d',
    'v2:server-e',
    'v2:deep',
  ]);
});
test('partial/zero/complete status does not claim global search exhaustion', () => {
  assert.match(
    api.selectionMessage({
      ...selection(0),
      status: 'partial',
      budget_exhausted: true,
    }),
    /일시적인 조회 제한/,
  );
  assert.match(api.selectionMessage(selection(2)), /2\/4/);
  assert.match(api.selectionMessage(selection()), /4\/4/);
});
test('strategy loading failure preserves completed report and warns instead of changing result', async () => {
  const m = map({
    selected_news_ids: ['a'],
    report_panel_open: true,
    last_result: { report_id: 'report', strategy_id: 'strategy' },
  });
  const c = controller(m);
  server((call) =>
    call.path.startsWith('/strategies')
      ? response(
          {
            error: {
              code: 'RESOURCE_NOT_FOUND',
              message: 'strategy missing',
              retryable: false,
              details: {},
            },
          },
          404,
        )
      : response(report()),
  );
  c.setVisible(true);
  await until(() => c.state.report);
  assert.equal(c.state.report.id, 'report');
  assert.equal(c.state.report.strategySummary, null);
  assert.ok(c.state.report.warnings.includes('STRATEGY_LOAD_FAILED'));
});

test('selection zero detaches active work and sends no replacement report request', async () => {
  const m = map({
    selected_news_ids: ['a'],
    report_panel_open: true,
    active_report_job_id: 'job',
  });
  const c = controller(m);
  server((call) => {
    assert.equal(call.method, 'PATCH');
    assert.deepEqual(call.body.selected_news_ids, []);
    return response({
      ...m,
      revision: 2,
      selected_news_ids: [],
      report_panel_open: false,
      active_report_job_id: null,
      last_result: null,
    });
  });
  await c.update({ selected_news_ids: [] });
  assert.equal(c.state.map.active_report_job_id, null);
  assert.equal(c.state.map.report_panel_open, false);
  assert.equal(c.state.report, null);
  assert.equal(calls.length, 1);
});
test('outgoing map mutation cannot overwrite another active map reference', async () => {
  const c = controller(map());
  api.rememberMap(api.mapFromApi(map({ map_id: 'new-map' }), session));
  server(() => response(map({ revision: 2, selected_news_ids: ['d'] })));
  await c.select('d');
  assert.equal(JSON.parse([...store.values()][0]).map_id, 'new-map');
});
test('outgoing map expiry cannot erase another active map reference', async () => {
  const c = controller(map());
  api.rememberMap(api.mapFromApi(map({ map_id: 'new-map' }), session));
  server(() =>
    response(
      {
        error: {
          code: 'RESOURCE_EXPIRED',
          message: 'old map expired',
          retryable: false,
          details: {},
        },
      },
      410,
    ),
  );
  await assert.rejects(c.select('a'), /old map expired/);
  assert.equal(JSON.parse([...store.values()][0]).map_id, 'new-map');
});
test('late restoration cannot replace a newly created navigation reference', async () => {
  api.rememberMap(api.mapFromApi(map(), session));
  let finish;
  server((call) =>
    call.path === '/session'
      ? response(session)
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const restoring = api.restoreNewsMap();
  await until(() => finish);
  api.rememberMap(api.mapFromApi(map({ map_id: 'new-map' }), session));
  finish(response(map()));
  await restoring;
  assert.equal(JSON.parse([...store.values()][0]).map_id, 'new-map');
});
test('stale last result for different evidence starts a new job rather than displaying old report', async () => {
  const m = map({
    selected_news_ids: ['d'],
    report_panel_open: true,
    last_result: { report_id: 'old-report', strategy_id: null },
  });
  const c = controller(m);
  server((call) =>
    call.method === 'PATCH'
      ? response({ ...m, revision: 2 })
      : call.method === 'POST'
        ? response(job({ job_id: 'new-job', request_news_ids: ['d'] }), 202)
        : call.path === '/reports/old-report'
          ? response(
              report({ report_id: 'old-report', requested_news_ids: ['a'] }),
            )
          : new Promise(() => {}),
  );
  await c.openReport();
  assert.equal(c.state.map.active_report_job_id, 'new-job');
  assert.equal(c.state.report, null);
});
test('storage denial keeps API navigation usable without copying state elsewhere', async () => {
  globalThis.sessionStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('storage denied');
    },
    removeItem: () => {
      throw new Error('storage denied');
    },
  };
  server((call) => response(call.path === '/session' ? session : map()));
  assert.equal((await api.fetchNewsMap('query')).map_id, 'map');
  assert.doesNotThrow(() => api.forgetMap());
});
test('server node IDs cannot collide with local layout IDs or root alias', () => {
  const m = map();
  m.nodes[1].node_id = 'root';
  m.nodes[2].node_id = 'k0';
  m.branches[0].child_node_ids = ['root', 'k0', 'server-d', 'server-e'];
  const t = tree.treeFromMap(api.mapFromApi(m, session));
  assert.equal(t.nodes.root.news.id, 'a');
  assert.equal(t.nodes['v2:root'].news.id, 'diverse');
  assert.equal(t.nodes['v2:k0'].news.id, 'higher');
  assert.equal(t.order.length, 5);
});

test('NewsMapExplorer centers camera at viewport midpoint by default and preserves sheet offsets', () => {
  const geo = explorerGeometry({ width: 1280, height: 832 });
  assert.equal(geo.cx, 640);
  assert.equal(geo.cy, 416);
  assert.equal(geo.detailCx, 380);
  assert.equal(geo.reportCx, 280);

  const wideGeo = explorerGeometry({ width: 1440, height: 900 });
  assert.equal(wideGeo.cx, 720);
  assert.equal(wideGeo.cy, 450);
  assert.equal(wideGeo.detailCx, 460);
  assert.equal(wideGeo.reportCx, 360);

  const defaultHtml = renderToStaticMarkup(createElement(NewsMapExplorer, {
    map: api.mapFromApi(map(), session),
    onExpired() {},
    onMap() {},
    onChrome() {},
  }));
  assert.match(
    defaultHtml,
    /class="explorer-camera"\s+style="transform:translate\(640\.0px,\s*416\.0px\)\s+scale\(1\.0000\)\s+translate\(0\.00px,\s*0\.00px\)/,
  );
  assert.doesNotMatch(defaultHtml, /translate\(542\.0px/);
});
