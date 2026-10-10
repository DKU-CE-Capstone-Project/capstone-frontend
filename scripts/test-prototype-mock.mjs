import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// 뉴스맵 프로토타입(design/newsmap-prototype) 적용분: mock 서비스, 궤도형 트리, 화면 마크업.
// Components with hooks must share react-dom/server's React instance, so React stays
// external and the bundle lives under node_modules where it resolves.
const outDir = await mkdtemp(join(process.cwd(), 'node_modules', '.econmind-prototype-mock-'));
await build({
  entryPoints: ['src/data/mockNewsMap.ts', 'src/layout/newsTree.ts', 'src/components/NewsMapExplorer.tsx'],
  bundle: true,
  format: 'esm', platform: 'node', outdir: outDir, outbase: 'src', splitting: true,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'lucide-react', 'motion/react'],
});
const load = (path) => import(pathToFileURL(join(outDir, path)).href);
const mock = await load('data/mockNewsMap.js');
const tree = await load('layout/newsTree.js');
const { NewsMapExplorer } = await load('components/NewsMapExplorer.js');
after(() => rm(outDir, { recursive: true, force: true }));
mock.setMockLatencyScale(0);

const PROTOTYPE_KEYWORDS = ['중동 전황', '원유', '해운', '방산', '환율', '정유', '에너지 ETF', '운임', '물류비'];

// ── mock 서비스 ─────────────────────────────────────────────────────

test('home and keyword map reproduce the prototype keywords', async () => {
  assert.deepEqual(await mock.fetchMockRecommendedKeywords(8), PROTOTYPE_KEYWORDS.slice(0, 8));
  assert.deepEqual((await mock.fetchMockKeywordMap('중동 전황')).keywords, PROTOTYPE_KEYWORDS);
  assert.equal((await mock.fetchMockKeywordMap('  ')).query, '중동 전황');
  const oil = await mock.fetchMockKeywordMap('원유');
  assert.equal(oil.keywords[0], '원유');
  assert.equal(oil.keywords.length, 9);
  assert.ok(oil.keywords.includes('중동 전황'));
  assert.equal(new Set(oil.keywords).size, oil.keywords.length);
});

test('topics: AI keywords and an unknown query get their own sample news', async () => {
  const ai = await mock.fetchMockNewsMap('반도체');
  assert.equal(ai.topicId, 'ai-infra');
  assert.equal(ai.root.id, 'ai-1');
  assert.equal(ai.related.length, 4);
  // 두 주제에 같은 기사가 있어도 ID가 달라 펼칠 때 다른 주제의 가지를 쓰지 않는다.
  const me = await mock.fetchMockNewsMap('중동 전황');
  assert.equal(new Set([...ai.related, ...me.related].map((n) => n.id)).size, 8);
  // 세 번째 가지는 프로토타입처럼 풀의 i*5 = 10번째 제목부터 낸다.
  const [fx] = await mock.fetchMockRelated(ai.related[2].id, 0);
  assert.deepEqual([fx.title, fx.keywords[0]], ['환율 민감 업종 실적 점검', '환율']);
  const bio = await mock.fetchMockNewsMap('바이오');
  assert.ok(bio.root.title.startsWith('바이오'));
  assert.ok([bio.root, ...bio.related].every((news) => news.source === '[샘플 기사]'));
  assert.deepEqual((await mock.fetchMockKeywordMap('바이오')).keywords.slice(0, 2), ['바이오', '바이오 관련주']);
});

test('news map center and first ring are the prototype mock articles without external images', async () => {
  const map = await mock.fetchMockNewsMap('중동 전황');
  assert.equal(map.root.title, '중동 항로 긴장 재점화, 원유 선물 장중 급등');
  assert.deepEqual(map.root.keywords, ['원유', '중동', '해협', '에너지']);
  assert.deepEqual(map.related.map((n) => n.id), ['oil-2', 'oil-3', 'currency-1', 'oil-4']);
  assert.ok([map.root, ...map.related].every((news) => news.imageUrl === ''));
  assert.equal(map.reportLabel, '중동 항로 리포트');
});

test('re-search alternates the center ring; branches page through their sample pool', async () => {
  const map = await mock.fetchMockNewsMap('중동 전황');
  const again = await mock.fetchMockRelated(map.root.id, 1, { research: true });
  assert.deepEqual(again.map((n) => n.title), ['국제유가 변동성 확대, 에너지주 등락 반복', '호르무즈 해협 통항 차질 우려 지속',
    '항공·화학 업종 원가 부담 부각', '긴장 완화 신호에 방산주 차익 실현']);
  assert.ok(again.every((n) => n.source === '[샘플 기사]' && n.summary === '' && n.publishedAt === ''));
  assert.deepEqual((await mock.fetchMockRelated(map.root.id, 2)).map((n) => n.id), map.related.map((n) => n.id));

  const kids = await mock.fetchMockRelated('oil-2', 0);
  assert.deepEqual(kids.map((n) => n.title), ['정제마진 반등, 정유사 실적 기대', '에너지 ETF 자금 유입 확대', '재고 지표 발표 앞두고 관망세']);
  assert.ok(kids.every((n) => n.thumbnailTone === 'oil' && n.keywords[0] === '정유'));
  assert.equal(new Set(kids.map((n) => n.id)).size, 3);
  const next = await mock.fetchMockRelated('oil-2', 1, { research: true });
  assert.deepEqual(next.map((n) => n.title), ['정유주 차익 실현 매물 출회', '휘발유 가격 상승 압력', '원유 재고 감소 전망']);
  const grandKids = await mock.fetchMockRelated(kids[0].id, 0);
  assert.equal(grandKids.length, 3);
  assert.ok(grandKids.every((n) => n.keywords[0] === '정유'));
  await assert.rejects(mock.fetchMockRelated('unknown-id', 0), /연관 뉴스를 찾을 기사가 없습니다/);
});

test('report reports its steps, titles by evidence count, and can be cancelled', async () => {
  const map = await mock.fetchMockNewsMap('중동 전황');
  const phases = [];
  const report = await mock.generateMockReport(map, map.related.slice(0, 2), (p) => phases.push(p));
  assert.deepEqual(phases, [1, 2]);
  assert.equal(report.title, '중동 항로 긴장과 에너지·물류 영향 리포트');
  assert.deepEqual(report.stockImpacts.map((s) => [s.name, s.direction]),
    [['SK이노베이션', 'mixed'], ['HMM', 'mixed'], ['한화에어로스페이스', 'up']]);
  const single = await mock.generateMockReport(map, [map.related[0]], () => {});
  assert.equal(single.title, '정유사 마진 개선 기대, 에너지주 강세 — 영향 리포트');
  await assert.rejects(mock.generateMockReport(map, [], () => {}), /근거 뉴스가 없습니다/);

  mock.setMockLatencyScale(1);
  try {
    const controller = new AbortController();
    const seen = [];
    const pending = mock.generateMockReport(map, [map.root], (p) => seen.push(p), controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.deepEqual(seen, []);
  } finally {
    mock.setMockLatencyScale(0);
  }
});

// ── 궤도형 트리 ─────────────────────────────────────────────────────

const news = (id) => ({ id, title: `${id} 제목`, source: '출처', publishedAt: '', summary: '', mockOriginalBody: '',
  thumbnailTone: 'oil', imageUrl: '', keywords: ['원유', '중동', '해협', '에너지'], relatedStockSymbols: [], sentiment: 'neutral' });

function settle(t) {
  const vel = {};
  let frames = 0;
  let energy = Infinity;
  while ((energy > 0.002 || frames < 20) && frames < 900) {
    for (let s = 0; s < 2; s++) energy = tree.stepLayout(t, vel);
    frames++;
  }
  return { frames, energy };
}

test('first ring sits on the 300×200 orbit at the prototype diagonals', () => {
  const t = tree.createTree(news('root'), ['a', 'b', 'c', 'd'].map(news));
  const [a, b, c, d] = t.order.slice(1).map((id) => t.nodes[id]);
  const at = (deg) => [300 * Math.cos(deg * Math.PI / 180), 200 * Math.sin(deg * Math.PI / 180)];
  for (const [n, deg] of [[a, -45], [b, 45], [c, 135], [d, -135]]) {
    const [x, y] = at(deg);
    assert.ok(Math.abs(n.x - x) < 1e-9 && Math.abs(n.y - y) < 1e-9, `${n.news.id} at ${deg}°`);
  }
  assert.equal(t.nodes.root.expanded, true);
  assert.ok(tree.showsKeywords(t));
});

test('each level shrinks cards and orbits by 0.6 while the camera zooms back', () => {
  assert.deepEqual([0, 1, 2, 3].map((level) => +tree.sizeOf({ level }).toFixed(2)), [260, 180, 108, 64.8]);
  assert.deepEqual([1, 2, 3].map((level) => +tree.ringRadius({ level }).toFixed(2)), [250, 150, 90]);
  for (const level of [1, 2, 3, 4]) {
    assert.ok(Math.abs(tree.sizeOf({ level }) * tree.zoomFor({ level }) - 180) < 1e-9);
  }
});

test('expanding, settling and re-searching keep branches on their orbits without overlaps', () => {
  const t = tree.createTree(news('root'), ['a', 'b', 'c', 'd'].map(news));
  const first = t.order[1];
  const kids = tree.addChildren(t, first, ['a1', 'a2', 'a3'].map(news));
  t.nodes[first].expanded = true;
  assert.ok(kids.every((k) => k.r0 === 250 && k.level === 2));
  assert.equal(tree.showsKeywords(t), false);
  const grand = tree.addChildren(t, kids[1].id, ['g1', 'g2', 'g3'].map(news));
  t.nodes[kids[1].id].expanded = true;
  assert.ok(grand.every((g) => g.r0 === 150 && g.level === 3));

  const { energy } = settle(t);
  assert.ok(energy <= 0.002, `settled (${energy})`);
  const ids = t.order;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const p = t.nodes[ids[i]], q = t.nodes[ids[j]];
      const gap = Math.hypot(p.x - q.x, p.y - q.y) - (tree.sizeOf(p) + tree.sizeOf(q)) / 2;
      assert.ok(gap > 0, `${p.news.id} and ${q.news.id} overlap by ${-gap.toFixed(1)}px`);
    }
  }
  for (const k of kids) {
    const dist = Math.hypot(k.x - t.nodes[first].x, k.y - t.nodes[first].y);
    assert.ok(Math.abs(dist - 250) / 250 < 0.25, `${k.news.id} orbit ${dist.toFixed(1)}`);
  }
  assert.equal(t.nodes.root.x, 0);
  assert.equal(t.nodes.root.y, 0);

  const removed = tree.removeDescendants(t, first);
  assert.deepEqual(new Set(removed), new Set([...kids, ...grand].map((n) => n.id)));
  assert.equal(t.order.length, 5);
  assert.ok(removed.every((id) => !t.nodes[id]));
});

test('camera limits keep the view inside the tree and the deepest card readable', () => {
  const t = tree.createTree(news('root'), ['a', 'b', 'c', 'd'].map(news));
  const viewport = { width: 1280, height: 832 };
  const root = t.nodes.root;
  const lim = tree.zoomLimits(t, root, viewport);
  assert.ok(lim.min <= 1 && lim.max >= 1);
  assert.ok(Math.abs(lim.max - 300 / 180) < 1e-9);
  const b = tree.treeBounds(t);
  assert.deepEqual([b.x0, b.x1, b.y0, b.y1], [-480, 480, -308, 308]);
  const pan = tree.clampPan({ x: -99999, y: 99999 }, 1, root, t);
  assert.deepEqual(pan, { x: -480, y: 308 });
  const inside = tree.clampPan({ x: 40, y: -20 }, 1, root, t);
  assert.deepEqual(inside, { x: 40, y: -20 });
});

test('drawing paths match the prototype geometry', () => {
  const t = tree.createTree(news('root'), ['a', 'b', 'c', 'd'].map(news));
  assert.equal(tree.keywordEdgePaths(4), 'M0 -122 L0 -228 M122 0 L400 0 M0 122 L0 228 M-122 0 L-400 0');
  assert.deepEqual(tree.keywordSlots(['원유', '중동', '해협', '에너지']).map(({ x, y }) => [x, y]),
    [[0, -268], [440, 0], [0, 268], [-440, 0]]);
  const rings = tree.ringPaths(t, 'root');
  assert.equal(rings.length, tree.RING_LEVELS);
  assert.ok(rings[0].includes('a300 200'));
  assert.ok(rings[1].includes('a440 268'));
  assert.equal(tree.edgePaths(t).match(/M/g).length, 4);
  const mini = tree.miniMap(t, { x0: -542, x1: 738, y0: -420, y1: 412 });
  assert.equal(mini.dots.length, 5);
  assert.ok(mini.dots.every((d) => d.x >= 0 && d.x <= 204 && d.y >= 0 && d.y <= 120));
  assert.ok(mini.view.w <= 204 && mini.view.h <= 120);
  assert.equal(tree.shortTitle('중동 항로 긴장 재점화, 원유 선물'), '중동 항로 긴장 재점화…');
});

// ── 화면 ───────────────────────────────────────────────────────────

test('explorer renders the prototype map with closed detail and report panels', async () => {
  const map = await mock.fetchMockNewsMap('중동 전황');
  const markup = renderToStaticMarkup(createElement(NewsMapExplorer, {
    map, onChrome: () => {}, onOpenKeyword: () => {},
  }));
  for (const text of [map.root.title, ...map.related.map((n) => n.title), '원유 키워드맵 열기', '에너지 키워드맵 열기',
    'Space + 클릭', '처음 뉴스맵으로', '미니맵', '유료 프리뷰', 'AI REPORT']) {
    assert.ok(markup.includes(text), text);
  }
  assert.equal(markup.match(/class="map-card-detail"/g).length, 5);
  assert.equal(markup.match(/<aside class="news-sheet[^>]*aria-hidden="true"/g).length, 2);
  assert.ok(!markup.includes('is-open'));
  assert.ok(!markup.includes('selection-tray'));
});
