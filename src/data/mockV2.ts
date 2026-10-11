/** Explicit browser-only local UI fixture. Never used by the production API path. */
import { ServiceError } from './serviceError';
import {
  fetchMockNewsMap,
  fetchMockRelated,
  setMockLatencyScale,
} from './mockNewsMap';
import type {
  ApiMap,
  ApiCard,
  ApiReport,
  ApiStrategy,
  ReportJob,
  Session,
  Selection,
} from './newsMapService';
import type { NewsCard } from './mockData';
const now = () => new Date().toISOString();
const expiry = () => new Date(Date.now() + 24 * 3600_000).toISOString();
let session: Session | null = null;
const maps = new Map<string, ApiMap>();
const jobs = new Map<string, ReportJob>();
const reports = new Map<string, ApiReport>();
const strategies = new Map<string, ApiStrategy>();
const keys = new Map<string, { body: string; job: string }>();
let seq = 0;
const copy = <T>(value: T): T => structuredClone(value);
const card = (n: NewsCard): ApiCard => ({
  news_id: n.id,
  title: n.title,
  description: n.summary,
  source_name: '[로컬 fixture] ' + n.source,
  published_at: null,
  source_url: n.sourceUrl ?? null,
  thumbnail_url: null,
  keywords: n.keywords,
  categories: n.categories ?? [],
});
const selection = (requested: number, returned: number): Selection => ({
  status: returned < requested ? 'insufficient' : 'complete',
  requested,
  returned,
  shortage: returned < requested,
  reason: returned < requested ? 'no_eligible_related' : null,
  budget_exhausted: false,
});
async function fail(
  status: number,
  code: string,
  message: string,
): Promise<never> {
  throw new ServiceError(message, status, {
    code,
    message,
    retryable: false,
    details: {},
  });
}
async function owned(id: string) {
  return (
    maps.get(id) ?? fail(404, 'RESOURCE_NOT_FOUND', '탐색을 찾을 수 없습니다.')
  );
}
async function revision(map: ApiMap, input: { expected_revision?: number }) {
  if (map.revision !== input.expected_revision)
    await fail(
      409,
      'MAP_REVISION_CONFLICT',
      '탐색이 변경됐어요. 최신 상태를 확인하세요.',
    );
}
function detached(map: ApiMap) {
  const job = map.active_report_job_id
    ? jobs.get(map.active_report_job_id)
    : null;
  if (job && !['completed', 'failed', 'cancelled'].includes(job.status))
    job.status = 'cancel_requested';
  map.active_report_job_id = null;
  map.last_result = null;
}
export async function mockV2Request(
  method: string,
  path: string,
  input?: unknown,
  signal?: AbortSignal,
  key?: string,
): Promise<unknown> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  setMockLatencyScale(0);
  const body = input as Record<string, any> | undefined;
  if (path === '/session') {
    if (method === 'DELETE') {
      session = null;
      maps.clear();
      jobs.clear();
      keys.clear();
      return;
    }
    const resumed = !!session;
    session ??= {
      session_epoch: crypto.randomUUID(),
      resumed: false,
      expires_at: expiry(),
      prototype_tier: 'FREE',
      capabilities: {
        max_report_articles: 1,
        initial_related_target: 4,
        branch_related_target: 3,
        max_map_nodes: 40,
        max_map_depth: 4,
      },
    };
    return copy({ ...session, resumed });
  }
  if (!session) await mockV2Request('GET', '/session');
  if (path === '/maps' && method === 'POST') {
    const source = await fetchMockNewsMap(body!.query);
    const id = crypto.randomUUID();
    const items = [source.root, ...source.related];
    const nodes = items.map((news, i) => ({
      node_id: `fixture-node-${seq++}`,
      news_id: news.id,
      parent_node_id: null as string | null,
      level: i ? 1 : 0,
      expanded: !i,
      batch: 0,
      news: card(news),
    }));
    for (const n of nodes.slice(1)) n.parent_node_id = nodes[0].node_id;
    const map: ApiMap = {
      map_id: id,
      revision: 1,
      query: body!.query,
      state: 'active',
      root_node_id: nodes[0].node_id,
      nodes,
      branches: [
        {
          parent_node_id: nodes[0].node_id,
          child_node_ids: nodes.slice(1).map((n) => n.node_id),
          display_selection: selection(4, nodes.length - 1),
          last_attempt: selection(4, nodes.length - 1),
        },
      ],
      initial_selection: selection(4, nodes.length - 1),
      selected_news_ids: [],
      detail_news_id: null,
      report_panel_open: false,
      active_report_job_id: null,
      last_result: null,
      expires_at: expiry(),
    };
    maps.set(id, map);
    return copy(map);
  }
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'maps') {
    const map = await owned(parts[1]);
    if (method === 'GET') return copy(map);
    if (method === 'DELETE') {
      detached(map);
      maps.delete(map.map_id);
      return;
    }
    await revision(map, body!);
    if (method === 'PATCH') {
      if (body!.selected_news_ids) {
        if (
          body!.selected_news_ids.length >
          session!.capabilities.max_report_articles
        )
          return fail(
            403,
            'PLAN_ARTICLE_LIMIT_EXCEEDED',
            '무료 리포트는 기사 1건입니다.',
          );
        if (
          JSON.stringify(map.selected_news_ids) !==
          JSON.stringify(body!.selected_news_ids)
        )
          detached(map);
        map.selected_news_ids = body!.selected_news_ids;
        if (!map.selected_news_ids.length) map.report_panel_open = false;
      }
      if ('detail_news_id' in body!) map.detail_news_id = body!.detail_news_id;
      if ('report_panel_open' in body!)
        map.report_panel_open = body!.report_panel_open;
    } else if (parts[2] === 'branches') {
      const parent = map.nodes.find((n) => n.node_id === body!.parent_node_id)!;
      if (parent.level >= session!.capabilities.max_map_depth)
        return fail(422, 'MAP_DEPTH_LIMIT_REACHED', '최대 탐색 깊이입니다.');
      const kids = (
        await fetchMockRelated(parent.news_id, parent.batch + 1, {
          research: body!.mode === 'research',
        })
      )
        .filter((n) => !map.nodes.some((old) => old.news_id === n.id))
        .slice(0, parent.level === 0 ? 4 : 3);
      if (kids.length) {
        const removed = new Set<string>();
        const visit = (id: string) => {
          map.nodes
            .filter((n) => n.parent_node_id === id)
            .forEach((n) => {
              removed.add(n.node_id);
              visit(n.node_id);
            });
        };
        visit(parent.node_id);
        const lost = map.nodes
          .filter((n) => removed.has(n.node_id))
          .map((n) => n.news_id);
        map.nodes = map.nodes.filter((n) => !removed.has(n.node_id));
        map.branches = map.branches.filter(
          (b) =>
            !removed.has(b.parent_node_id) &&
            b.parent_node_id !== parent.node_id,
        );
        map.selected_news_ids = map.selected_news_ids.filter(
          (id) => !lost.includes(id),
        );
        if (lost.includes(map.detail_news_id ?? '')) map.detail_news_id = null;
        if (
          lost.some((id) =>
            jobs
              .get(map.active_report_job_id ?? '')
              ?.request_news_ids.includes(id),
          )
        )
          detached(map);
        const nodes = kids.map((news) => ({
          node_id: `fixture-node-${seq++}`,
          news_id: news.id,
          parent_node_id: parent.node_id,
          level: parent.level + 1,
          expanded: false,
          batch: 0,
          news: card(news),
        }));
        map.nodes.push(...nodes);
        map.branches.push({
          parent_node_id: parent.node_id,
          child_node_ids: nodes.map((n) => n.node_id),
          display_selection: selection(
            parent.level === 0 ? 4 : 3,
            nodes.length,
          ),
          last_attempt: selection(parent.level === 0 ? 4 : 3, nodes.length),
        });
      } else {
        const branch = map.branches.find(
          (b) => b.parent_node_id === parent.node_id,
        );
        if (branch) branch.last_attempt = selection(3, 0);
      }
      parent.expanded = true;
      parent.batch++;
    } else if (parts[2] === 'reset') {
      detached(map);
      const source = await fetchMockNewsMap(map.query);
      const savedId = map.map_id;
      maps.delete(savedId);
      const fresh = (await mockV2Request('POST', '/maps', {
        query: source.keyword,
      })) as ApiMap;
      maps.delete(fresh.map_id);
      Object.assign(map, fresh, { map_id: savedId, revision: map.revision });
      maps.set(savedId, map);
    }
    map.revision++;
    return copy(map);
  }
  if (path === '/report-jobs' && method === 'POST') {
    const encoded = JSON.stringify(body);
    const existing = keys.get(key!);
    if (existing) {
      if (existing.body !== encoded)
        return fail(409, 'IDEMPOTENCY_CONFLICT', '같은 키의 요청이 다릅니다.');
      return copy(jobs.get(existing.job));
    }
    const map = await owned(body!.map_id);
    await revision(map, body!);
    if (body!.news_ids.length > session!.capabilities.max_report_articles)
      return fail(
        403,
        'PLAN_ARTICLE_LIMIT_EXCEEDED',
        '무료 리포트는 기사 1건입니다.',
      );
    detached(map);
    const job: ReportJob = {
      job_id: crypto.randomUUID(),
      client_request_id: body!.client_request_id,
      map_id: map.map_id,
      accepted_map_revision: ++map.revision,
      status: 'queued',
      stage: 'queued',
      request_news_ids: body!.news_ids,
      progress: {
        requested: body!.news_ids.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
      },
      result: null,
      warnings: [],
      error: null,
      created_at: now(),
      updated_at: now(),
      expires_at: expiry(),
    };
    map.selected_news_ids = body!.news_ids;
    map.report_panel_open = true;
    map.active_report_job_id = job.job_id;
    map.detail_news_id = null;
    jobs.set(job.job_id, job);
    keys.set(key!, { body: encoded, job: job.job_id });
    return copy(job);
  }
  if (parts[0] === 'report-jobs') {
    const job = jobs.get(parts[1]);
    if (!job)
      return fail(404, 'RESOURCE_NOT_FOUND', '작업을 찾을 수 없습니다.');
    if (parts[2] === 'cancel' || job.status === 'cancel_requested') {
      job.status = 'cancelled';
      job.stage = 'done';
      return copy(job);
    }
    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      const steps: ReportJob['stage'][] = [
        'queued',
        'extracting',
        'analyzing',
        'verifying',
        'strategy',
        'saving',
        'done',
      ];
      job.stage = steps[steps.indexOf(job.stage) + 1];
      job.status = 'running';
      if (steps.indexOf(job.stage) >= 2)
        job.progress = {
          requested: job.request_news_ids.length,
          processed: job.request_news_ids.length,
          succeeded: job.request_news_ids.length,
          failed: 0,
        };
      if (job.stage === 'done') {
        const map = await owned(job.map_id);
        const nodes = job.request_news_ids.map(
          (id) => map.nodes.find((n) => n.news_id === id)!,
        );
        const reportId = crypto.randomUUID();
        const strategyId = crypto.randomUUID();
        reports.set(reportId, {
          schema_version: 2,
          report_id: reportId,
          title: '[로컬 fixture] 선택 기사 영향 리포트',
          event_summary: 'UI 연결 확인을 위한 합성 데이터입니다.',
          event_analysis: '실제 뉴스·모델을 호출하지 않았습니다.',
          market_impact: '실제 시장 영향 분석이 아닙니다.',
          stock_impacts: [],
          risk_factors: ['로컬 fixture'],
          requested_news_ids: job.request_news_ids,
          used_evidence: nodes.map((n) => ({
            news_id: n.news_id,
            title: n.news.title,
            source_name: n.news.source_name,
            source_url: n.news.source_url ?? 'https://example.test/fixture',
            published_at: null,
            body_id: crypto.randomUUID(),
            content_hash: '0'.repeat(64),
            input_char_count: 10,
            truncated: false,
          })),
          failed_evidence: [],
          coverage: {
            requested_count: nodes.length,
            used_count: nodes.length,
            failed_count: 0,
          },
          rag_evidence: [],
          verification: {
            status: 'unavailable',
            notes: ['로컬 fixture · 실제 검증 없음'],
          },
          created_at: now(),
        });
        strategies.set(strategyId, {
          schema_version: 2,
          strategy_id: strategyId,
          report_id: reportId,
          risk_level: 'medium',
          period: 'short',
          strategy_summary: '로컬 fixture 전략',
          risk_warning: '실제 투자 전략이 아닙니다.',
          strategy_items: [],
          created_at: now(),
        });
        job.status = 'completed';
        job.result = {
          report_id: reportId,
          strategy_id: strategyId,
          report_reused: false,
          strategy_reused: false,
        };
        if (map.active_report_job_id === job.job_id) {
          map.last_result = { report_id: reportId, strategy_id: strategyId };
          map.active_report_job_id = null;
          map.revision++;
        }
      }
    }
    return copy(job);
  }
  if (parts[0] === 'reports')
    return copy(
      reports.get(parts[1]) ??
        (await fail(404, 'RESOURCE_NOT_FOUND', '리포트를 찾을 수 없습니다.')),
    );
  if (parts[0] === 'strategies')
    return copy(
      strategies.get(parts[1]) ??
        (await fail(404, 'RESOURCE_NOT_FOUND', '전략을 찾을 수 없습니다.')),
    );
  return fail(404, 'RESOURCE_NOT_FOUND', '지원하지 않는 fixture 경로입니다.');
}
