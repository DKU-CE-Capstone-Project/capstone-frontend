import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Hooks must share react-dom/server's React instance, so React stays external
// and the bundle lives under node_modules where it resolves.
const viewDir = await mkdtemp(join(process.cwd(), 'node_modules', '.econmind-loading-stage-'));
await build({
  entryPoints: ['src/components/loadingStage.ts', 'src/components/ui.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: viewDir,
  external: ['react', 'react/jsx-runtime', 'react-dom', 'lucide-react', 'motion/react'],
});
const { loadingStage, nextStageIn, useLoadingStage, LOADING_STAGE_AT } = await import(
  pathToFileURL(join(viewDir, 'loadingStage.js')).href
);
const { LoadingOverlay } = await import(pathToFileURL(join(viewDir, 'ui.js')).href);
after(async () => {
  await rm(viewDir, { recursive: true, force: true });
});

test('elapsed time maps to honest stage copy without percentages', () => {
  const at = (ms) => loadingStage(ms).label;
  assert.equal(at(0), '뉴스 검색 중…');
  assert.equal(at(2499), '뉴스 검색 중…');
  assert.equal(at(2500), '관련 기사 고르는 중…');
  assert.equal(at(5999), '관련 기사 고르는 중…');
  assert.equal(at(6000), '거의 다 됐어요…');
  // A typical first Decision API call (~8s) is still on the "almost done" stage.
  assert.equal(at(8000), '거의 다 됐어요…');
  assert.equal(at(15000), '평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요');
  assert.equal(at(600000), '평소보다 오래 걸리고 있어요. 조금만 더 기다려 주세요');
  for (const ms of [0, 3000, 7000, 20000]) assert.doesNotMatch(at(ms), /%|\d/);
  assert.deepEqual(
    [0, 2500, 6000, 15000].map((ms) => loadingStage(ms).step),
    [0, 1, 2, 3],
  );
  assert.equal(loadingStage(14999).slow, false);
  assert.equal(loadingStage(15000).slow, true);
});

test('first stage copy is caller specific and later stages are shared', () => {
  assert.equal(loadingStage(0, '하위 뉴스 검색 중…').label, '하위 뉴스 검색 중…');
  assert.equal(loadingStage(3000, '하위 뉴스 검색 중…').label, '관련 기사 고르는 중…');
  assert.equal(loadingStage(-50).step, 0);
});

test('timer wakes only at stage boundaries and stops after the last stage', () => {
  assert.equal(nextStageIn(0), 2500);
  assert.equal(nextStageIn(1000), 1500);
  assert.equal(nextStageIn(2500), 3500);
  assert.equal(nextStageIn(-100), 2500);
  assert.equal(nextStageIn(14000), 1000);
  assert.equal(nextStageIn(LOADING_STAGE_AT.at(-1)), null);
  assert.equal(nextStageIn(60000), null);
});

test('hook is silent when idle and starts at the first stage for a new request', () => {
  const Probe = ({ k, first }) => {
    const stage = useLoadingStage(k, first);
    return createElement('span', null, stage ? stage.label : 'idle');
  };
  assert.equal(renderToStaticMarkup(createElement(Probe, { k: null })), '<span>idle</span>');
  assert.equal(renderToStaticMarkup(createElement(Probe, { k: 3 })), '<span>뉴스 검색 중…</span>');
  assert.equal(
    renderToStaticMarkup(createElement(Probe, { k: 'node-1', first: '다시 검색하는 중…' })),
    '<span>다시 검색하는 중…</span>',
  );
});

test('loading overlay announces politely and offers cancel only when given', () => {
  const plain = renderToStaticMarkup(createElement(LoadingOverlay, { label: '뉴스 검색 중…' }));
  assert.match(plain, /role="status"/);
  assert.match(plain, /aria-live="polite"/);
  assert.match(plain, /뉴스 검색 중…/);
  assert.doesNotMatch(plain, /loading-cancel/);
  assert.doesNotMatch(plain, /progress|%/);
  const cancellable = renderToStaticMarkup(
    createElement(LoadingOverlay, { label: '관련 기사 고르는 중…', onCancel: () => undefined }),
  );
  assert.match(cancellable, /<button type="button" class="loading-cancel">취소<\/button>/);
});
