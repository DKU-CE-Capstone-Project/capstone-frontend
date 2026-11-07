import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.evidence-test-'));
await build({
  entryPoints: [
    'src/data/reportEvidence.ts',
    'src/components/CitationChips.tsx',
    'src/components/EvidenceChain.tsx',
    'src/components/EvidenceStatusBadge.tsx',
  ],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: dir,
  outbase: 'src',
  external: ['react', 'react/jsx-runtime'],
});
const evidenceApi = await import(pathToFileURL(join(dir, 'data/reportEvidence.js')));
const { CitationChips } = await import(pathToFileURL(join(dir, 'components/CitationChips.js')));
const { EvidenceChain } = await import(pathToFileURL(join(dir, 'components/EvidenceChain.js')));
const { EvidenceStatusBadge } = await import(pathToFileURL(join(dir, 'components/EvidenceStatusBadge.js')));
after(() => rm(dir, { recursive: true, force: true }));

const evidence = [
  { news_id: 'a', title: '첫 기사' },
  { news_id: 'b', title: '둘째 기사' },
];
const numbers = evidenceApi.numberEvidence(['b', 'failed', 'a']);
const impact = (name, ticker, newsIds = ['a']) => ({
  name, ticker, impact: `${name} 영향`, direction: 'up', evidence_news_ids: newsIds,
});

test('citations use selected-news numbering and resolve only used articles', () => {
  assert.deepEqual(
    evidenceApi.resolveCitations(['a', 'b', 'a', 'failed', 'missing'], evidence, numbers),
    {
      citations: [
        { newsId: 'a', title: '첫 기사', number: 3 },
        { newsId: 'b', title: '둘째 기사', number: 1 },
      ],
      missingCount: 2,
    },
  );
  assert.equal(evidenceApi.resolveCitations(['a'], evidence, new Map()).missingCount, 1);
  const html = renderToStaticMarkup(createElement(CitationChips, {
    newsIds: ['b', 'a', 'b', 'failed'], evidence, numbers, onSelect() {},
  }));
  assert.match(html, /근거 #1: 둘째 기사 보기/);
  assert.match(html, /근거 #3: 첫 기사 보기/);
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.match(html, /인용 기사 1건 확인 불가/);
});

test('node status comes from the completed report, including contradictory data', () => {
  const report = { evidence, failedEvidence: [{ news_id: 'failed' }, { news_id: 'b' }] };
  assert.equal(evidenceApi.evidenceStatus(null, 'a'), null);
  assert.equal(evidenceApi.evidenceStatus(report, 'a'), 'used');
  assert.equal(evidenceApi.evidenceStatus(report, 'failed'), 'failed');
  assert.equal(evidenceApi.evidenceStatus(report, 'b'), 'conflict');
  assert.equal(evidenceApi.evidenceStatus(report, 'other'), null);
  assert.match(renderToStaticMarkup(createElement(EvidenceStatusBadge, { status: 'failed' })), /본문 실패/);
  assert.equal(renderToStaticMarkup(createElement(EvidenceStatusBadge, { status: null })), '');
});

test('strategy chains match exact name and ticker, preserve direction, and show missing links', () => {
  const impacts = [impact('회사', null, ['b']), impact('회사', '123', ['a']), impact('다른회사', null)];
  const strategyItems = [
    { stock_name: '회사', ticker: null, action: 'watch', reason: '불확실해 관망' },
    { stock_name: '회사', ticker: '999', action: 'buy', reason: '연결 없는 전략' },
  ];
  assert.deepEqual(evidenceApi.matchingImpacts(strategyItems[0], impacts), [impacts[0]]);
  assert.deepEqual(evidenceApi.matchingImpacts(strategyItems[1], impacts), []);
  const report = { strategyItems, stockImpacts: impacts, evidence };
  const html = renderToStaticMarkup(createElement(EvidenceChain, { report, numbers, onSelect() {} }));
  assert.match(html, /전략의 분석 근거/);
  assert.match(html, /관망/);
  assert.match(html, /상승 요인/);
  assert.match(html, /근거 #1: 둘째 기사 보기/);
  assert.match(html, /연결된 종목 영향을 찾을 수 없습니다/);
  assert.doesNotMatch(html, /다른회사 영향/);
  assert.equal(renderToStaticMarkup(createElement(EvidenceChain, {
    report: { ...report, strategyItems: [] }, numbers, onSelect() {},
  })), '');
});
