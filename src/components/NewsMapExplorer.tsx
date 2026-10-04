import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from 'react';
import { Check, ExternalLink, FileText, LineChart, Newspaper, RotateCcw, X } from 'lucide-react';
import type { NewsCard, Report } from '../data/mockData';
import {
  MAX_DEPTH,
  MAX_MAP_NEWS,
  MAX_REPORT_NEWS,
  MAX_RESEARCH,
  USE_MOCK,
  fetchRelated,
  generateReport,
  reportTitle,
  type NewsMapData,
  type ReportPhase,
} from '../data/newsMapService';
import {
  KEYWORD_SIZE,
  addChildren,
  ancestors,
  baseOf,
  clampPan,
  createTree,
  edgePaths,
  keywordEdgePaths,
  keywordSlots,
  miniMap,
  removeDescendants,
  ringPaths,
  shortTitle,
  showsKeywords,
  sizeOf,
  stepLayout,
  zoomFor,
  zoomLimits,
  type MapNode,
  type MapTree,
  type Vec,
} from '../layout/newsTree';
import { useFieldSize } from '../layout/useFieldScale';
import { PremiumPreview } from './ui';

/**
 * 03 뉴스맵 · 상세 · 레포트 — design/newsmap-prototype/NewsMap.dc.html을 옮긴 화면.
 *
 * 뉴스맵·뉴스 상세·리포트가 한 화면 안에서 이어진다. 상세와 리포트는 오른쪽 패널로
 * 열리고, 카메라가 해당 카드(들)로 이동한다. 데이터는 newsMapService.ts 에서 받는다
 * (기본 실제 API, VITE_NEWS_MAP_SOURCE=mock 이면 브라우저 mock).
 *
 * | 조작 | 동작 |
 * | 클릭 | 카드 선택·해제 (리포트 근거) |
 * | 더블클릭 | 그 카드를 화면 가운데로 이동 |
 * | Space + 클릭 (키보드 Shift+Enter) | 그 카드 기준 검색 — 처음이면 하위 뉴스 펼치기, 이미 펼쳤으면 재검색 |
 * | 휠 / 끌기 | 확대·축소 / 화면 이동 (트리 범위 안) |
 */

export type NewsMapPanel = 'none' | 'detail' | 'report';

/** 셸(헤더 칩·상태·하단 네비 위치)에 알리는 화면 상태 */
export type NewsMapChrome = { chip: string; status: string; panel: NewsMapPanel };

export type NewsMapExplorerHandle = {
  /** 하단 네비의 리포트 버튼: 선택한 카드(없으면 지금 보는 상세 카드)로 리포트를 연다. */
  openReport: () => void;
};

export const NEWS_MAP_DEFAULT_STATUS = '카드를 눌러 리포트에 쓸 뉴스를 고르세요';

const DETAIL_WIDTH = 520;
const REPORT_WIDTH = 720;
/** 오른쪽 위 유료 프리뷰가 차지하는 폭. 카메라 중심을 그만큼 왼쪽으로 옮긴다. */
const PREVIEW_GUTTER = 196;

const RING_OPACITY = [0.95, 0.5, 0.28, 0.16, 0.1, 0.07];
const RING_WIDTH = [1.8, 1.4, 1.2, 1.1, 1, 1];

const DIRECTION_LABEL: Record<Report['stockImpacts'][number]['direction'], string> = {
  up: '상승 요인',
  down: '하락 요인',
  mixed: '혼조',
};

type Camera = { focus: string; uz: number; pan: Vec };
type Viewport = { width: number; height: number };

type Drag = {
  x: number;
  y: number;
  px: number;
  py: number;
  el: HTMLDivElement;
  pid: number;
  moved: boolean;
};

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 카메라 상태를 트리 범위에 맞춘다. 재검색으로 트리가 작아져도 범위를 벗어나지 않게 매번 다시 맞춘다. */
function resolveCamera(tree: MapTree, camera: Camera, viewport: Viewport) {
  const focus = tree.nodes[camera.focus] ?? tree.nodes.root;
  const lim = zoomLimits(tree, focus, viewport);
  const base = zoomFor(focus);
  const zoom = clamp(lim.min, base * camera.uz, lim.max);
  const pan = clampPan(camera.pan, zoom, focus, tree);
  return { focus, lim, base, zoom, pan };
}

/** 프로토타입은 1280×832 데스크톱 전용이다. 1280×832에서 카메라 중심은 (542, 420)이다. */
function geometry({ width: W, height: H }: Viewport) {
  return {
    cx: (W - PREVIEW_GUTTER) / 2,
    cy: H / 2 + 4,
    /** 상세 패널이 열렸을 때 남는 왼쪽 영역의 가운데 */
    detailCx: (W - DETAIL_WIDTH) / 2,
    reportCx: (W - REPORT_WIDTH) / 2,
    reportFit: { w: Math.max(160, W - REPORT_WIDTH - 90), h: Math.max(160, H - 272) },
  };
}

export function NewsMapExplorer({
  map,
  onChrome,
  onOpenKeyword,
  ref,
  orbitRotating = 3,
  orbitSpeed = 1,
}: {
  map: NewsMapData;
  onChrome: (chrome: NewsMapChrome) => void;
  /** 중앙 키워드 궤도의 키워드를 누르면 그 키워드의 키워드맵을 연다. */
  onOpenKeyword: (keyword: string) => void;
  ref?: Ref<NewsMapExplorerHandle>;
  /** 몇 번째 궤도까지 회전할지 (프로토타입 Tweaks 기본값 3) */
  orbitRotating?: number;
  /** 궤도 회전 속도 배율 */
  orbitSpeed?: number;
}) {
  const { ref: fieldRef, size } = useFieldSize();
  const viewport: Viewport = { width: size.width || 1280, height: size.height || 832 };
  const geo = geometry(viewport);

  // 트리는 자동 정렬이 매 프레임 제자리에서 고친다. 그리기는 frame 값으로 다시 요청한다.
  const treeRef = useRef<MapTree | null>(null);
  if (!treeRef.current) treeRef.current = createTree(map.root, map.related);
  const tree = treeRef.current;
  const [, setFrame] = useState(0);

  const [camera, setCamera] = useState<Camera>({ focus: 'root', uz: 1, pan: { x: 0, y: 0 } });
  const [dragging, setDragging] = useState(false);
  const [wheeling, setWheeling] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lastDetailId, setLastDetailId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPhase, setReportPhase] = useState<ReportPhase>(0);
  const [report, setReport] = useState<Report | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [status, setStatus] = useState(NEWS_MAP_DEFAULT_STATUS);
  const [spaceHeld, setSpaceHeld] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const velRef = useRef<Record<string, Vec>>({});
  const rafRef = useRef<number | null>(null);
  const simFrames = useRef(0);
  const dragRef = useRef<Drag | null>(null);
  const justDragged = useRef(false);
  const spaceDown = useRef(false);
  const loadingRef = useRef<string | null>(null);
  const reportAbort = useRef<AbortController | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alive = useRef(true);
  /** 노드별 이전 펼치기·재검색 결과 기사 ID — 재검색이 같은 기사를 다시 내지 않게 제외 목록에 넣는다. */
  const historyRef = useRef<Record<string, string[]>>({});

  // ── 자동 정렬 루프 ───────────────────────────────────────────────
  const startSim = useCallback(() => {
    simFrames.current = 0;
    if (rafRef.current !== null) return;
    const tick = () => {
      rafRef.current = null;
      const t = treeRef.current;
      if (!t) return;
      let energy = 0;
      for (let s = 0; s < 2; s++) energy = stepLayout(t, velRef.current);
      simFrames.current++;
      setFrame((f) => f + 1);
      if ((energy > 0.002 || simFrames.current < 20) && simFrames.current < 900) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    alive.current = true;
    startSim();
    return () => {
      alive.current = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      reportAbort.current?.abort();
      clearTimeout(wheelTimer.current);
    };
  }, [startSim]);

  // ── 동작 ─────────────────────────────────────────────────────────

  const abortReport = () => {
    reportAbort.current?.abort();
    reportAbort.current = null;
  };

  const newsOf = (ids: string[]): NewsCard[] =>
    ids.map((id) => tree.nodes[id]?.news).filter((news): news is NewsCard => !!news);

  // 생성 단계: 본문 추출 → 분석 → 전략 (POST /reports {news_ids} → GET /reports/{id} 폴링)
  // 같은 기사가 여러 카드에 있어도 근거는 기사 ID 기준으로 한 번만 보낸다.
  const generate = (ids: string[]) => {
    abortReport();
    const controller = new AbortController();
    reportAbort.current = controller;
    setReportPhase(0);
    setReport(null);
    const evidenceNews = [...new Map(newsOf(ids).map((news) => [news.id, news])).values()];
    generateReport(map, evidenceNews, setReportPhase, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setReport(next);
        setReportPhase(3);
        const notes = [
          next.isFallback ? 'AI 분석을 만들지 못해 대체 문구를 표시해요' : '',
          next.descriptionOnlyCount ? `본문 없이 설명만 쓴 기사 ${next.descriptionOnlyCount}건` : '',
        ].filter(Boolean);
        setStatus(notes.length ? `리포트가 준비됐어요 · ${notes.join(' · ')}` : '리포트가 준비됐어요 · Esc로 닫기');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus(error instanceof Error ? error.message : '리포트를 만들지 못했어요');
      });
  };

  const closeReport = () => {
    abortReport();
    setReportOpen(false);
    setStatus('뉴스맵으로 돌아왔어요');
  };

  const closeDetail = () => {
    setDetailId(null);
    setStatus('뉴스맵으로 돌아왔어요');
  };

  // 더블클릭: 그 카드를 화면 가운데로 옮기기만 한다. 검색·펼치기는 하지 않는다.
  const center = (id: string) => {
    const n = tree.nodes[id];
    if (!n) return;
    setCamera({ focus: id, uz: 1, pan: { x: 0, y: 0 } });
    setStatus(`‘${shortTitle(n.news.title)}’ 을 가운데로 옮겼어요`);
  };

  // 상세: 그 카드로 확대하고 오른쪽 패널을 연다
  const openDetail = (id: string) => {
    const n = tree.nodes[id];
    if (!n) return;
    setDetailId(id);
    setLastDetailId(id);
    setStatus(`‘${shortTitle(n.news.title)}’ 자세히 보기 · Esc로 닫기`);
  };

  // 리포트: 선택한 카드(없으면 지금 보는 카드)를 근거로 리포트를 만든다
  const openReport = (fromId: string | null) => {
    let ids = sel.filter((k) => tree.nodes[k]);
    if (!ids.length && fromId && tree.nodes[fromId]) ids = [fromId];
    if (!ids.length) {
      setStatus('먼저 리포트에 쓸 카드를 클릭해서 선택하세요');
      return;
    }
    setSel(ids);
    setReportOpen(true);
    setDetailId(null);
    setStatus(`근거 뉴스 ${ids.length}건으로 리포트를 만드는 중… · Esc로 닫기`);
    generate(ids);
  };

  // 한 번 클릭: 선택/해제. 리포트가 열려 있으면 근거가 바뀐 리포트를 다시 만든다.
  const toggleSelect = (id: string) => {
    const has = sel.includes(id);
    if (!has && sel.length >= MAX_REPORT_NEWS) {
      setStatus(`리포트 근거는 최대 ${MAX_REPORT_NEWS}건까지 고를 수 있어요`);
      return;
    }
    const next = has ? sel.filter((k) => k !== id) : [...sel, id];
    setSel(next);
    if (reportOpen) {
      const live = next.filter((k) => tree.nodes[k]);
      if (!live.length) {
        closeReport();
        return;
      }
      setStatus('근거가 바뀌어 리포트를 다시 만드는 중…');
      generate(live);
      return;
    }
    const n = tree.nodes[id];
    if (n) setStatus(`‘${shortTitle(n.news.title)}’ ${has ? '선택 해제' : '선택'} · 선택 ${next.length}건`);
  };

  const clearSel = () => {
    setSel([]);
    setStatus('선택을 모두 해제했어요');
  };

  // Space + 클릭: 처음이면 하위 뉴스를 펼치고, 이미 펼친 카드면 다시 검색한다.
  const research = async (id: string) => {
    if (loadingRef.current) return;
    const t = tree;
    const n = t.nodes[id];
    if (!n) return;
    const short = shortTitle(n.news.title);
    const again = n.expanded;
    const batch = again ? n.batch + 1 : n.batch;
    // 탐색 상한 (docs/10 D2): 깊이·맵 전체 기사 수·부모별 재검색 횟수
    if (!again && n.level >= MAX_DEPTH) {
      setStatus(`‘${short}’ 은 가장 깊은 단계라 더 펼칠 수 없어요`);
      return;
    }
    if (again && batch > MAX_RESEARCH) {
      setStatus(`‘${short}’ 은 이미 ${MAX_RESEARCH}번 다시 검색했어요`);
      return;
    }
    const shownIds = Object.values(t.nodes).map((node) => node.news.id);
    if (!again && new Set(shownIds).size >= MAX_MAP_NEWS) {
      setStatus(`뉴스맵에는 기사를 최대 ${MAX_MAP_NEWS}건까지 펼칠 수 있어요 · 초기화 후 다시 탐색하세요`);
      return;
    }
    loadingRef.current = id;
    setLoadingId(id);
    setStatus(again ? `‘${short}’ 기준으로 다시 검색하는 중…` : `‘${short}’ 기준으로 하위 뉴스를 불러오는 중…`);
    try {
      const exclude = [...shownIds, ...(historyRef.current[id] ?? [])];
      const { news: kids } = await fetchRelated(n.news.id, exclude, batch);
      // 기다리는 동안 화면을 나갔거나 처음 뉴스맵으로 돌아갔으면 버린다.
      if (!alive.current || treeRef.current !== t || !t.nodes[id]) return;
      if (!kids.length) {
        // 결과 소진은 정상 결과다. 재검색이면 기존 가지를 그대로 둔다.
        setStatus(`‘${short}’ 기준으로 더 찾을 연관 뉴스가 없어요`);
        return;
      }
      historyRef.current[id] = [...(historyRef.current[id] ?? []), ...kids.map((k) => k.id)];
      if (again) {
        const removed = new Set(removeDescendants(t, id));
        const keep = latest.current.sel.filter((k) => !removed.has(k));
        setSel(keep);
        if (latest.current.detailId && removed.has(latest.current.detailId)) setDetailId(null);
        if (latest.current.reportOpen && keep.length !== latest.current.sel.length) {
          if (keep.length) generate(keep);
          else closeReport();
        }
      }
      n.expanded = true;
      n.batch = batch;
      addChildren(t, id, kids);
      setStatus(again ? `‘${short}’ 연관 뉴스를 새로 불러왔어요` : `‘${short}’ 기준으로 하위 뉴스 ${kids.length}건을 불러왔어요`);
      startSim();
    } catch {
      if (alive.current && treeRef.current === t) setStatus(`‘${short}’ 연관 뉴스를 불러오지 못했어요`);
    } finally {
      if (treeRef.current === t) {
        loadingRef.current = null;
        if (alive.current) setLoadingId(null);
      }
    }
  };

  const reset = () => {
    abortReport();
    treeRef.current = createTree(map.root, map.related);
    velRef.current = {};
    historyRef.current = {};
    loadingRef.current = null;
    setLoadingId(null);
    setCamera({ focus: 'root', uz: 1, pan: { x: 0, y: 0 } });
    setSel([]);
    setDetailId(null);
    setReportOpen(false);
    setStatus('처음 뉴스맵으로 돌아왔어요');
    startSim();
  };

  // 창 리스너·비동기 응답·imperative handle은 최신 상태와 동작을 이 ref로 읽는다.
  const latest = useRef({ sel, detailId, reportOpen, camera, viewport, geo, openReport, closeReport, closeDetail });
  useLayoutEffect(() => {
    latest.current = { sel, detailId, reportOpen, camera, viewport, geo, openReport, closeReport, closeDetail };
  });

  useImperativeHandle(ref, () => ({
    openReport: () => latest.current.openReport(latest.current.detailId),
  }), []);

  // Esc: 리포트 → 상세 순으로 닫는다. 패널 안에 포커스가 있어도 동작하도록 창에 건다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = latest.current;
      if (s.reportOpen) {
        e.preventDefault();
        s.closeReport();
      } else if (s.detailId) {
        e.preventDefault();
        s.closeDetail();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── 휠 확대/축소: 커서 아래 지점을 고정한 채 배율을 바꾼다 ──
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = latest.current;
      if (s.detailId || s.reportOpen) return;
      const t = treeRef.current!;
      const { focus, lim, base, zoom: z, pan } = resolveCamera(t, s.camera, s.viewport);
      const z2 = clamp(lim.min, z * Math.exp(-e.deltaY * 0.0015), lim.max);
      const r = el.getBoundingClientRect();
      const sx = e.clientX - r.left - s.geo.cx;
      const sy = e.clientY - r.top - s.geo.cy;
      const k = z2 / z;
      const next = clampPan({ x: sx - k * (sx - pan.x), y: sy - k * (sy - pan.y) }, z2, focus, t);
      const edge = z2 >= lim.max - 1e-6 ? ' · 최대 확대' : z2 <= lim.min + 1e-6 ? ' · 트리 전체 보기' : '';
      setCamera({ focus: s.camera.focus, uz: z2 / base, pan: next });
      setWheeling(true);
      setStatus(`확대 ×${Math.round(z2 * 100) / 100}${edge}`);
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => setWheeling(false), 160);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 상세에서 다른 기사로 바꾸면 패널 스크롤을 처음으로 돌린다.
  useEffect(() => {
    detailRef.current?.scrollTo(0, 0);
  }, [detailId]);

  // ── 누른 채 끌어서 화면 이동 ──
  // 4px 이상 움직여야 드래그로 본다. 그 전에는 카드·버튼의 클릭이 그대로 동작한다.
  const panDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (detailId || reportOpen) return; // 상세·리포트 중에는 화면 고정
    if (e.button !== 0) return;
    const { pan } = resolveCamera(tree, camera, viewport);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, el: e.currentTarget, pid: e.pointerId, moved: false };
  };

  const panMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      try {
        d.el.setPointerCapture(d.pid);
      } catch {
        // 이미 놓은 포인터면 캡처 없이 계속한다
      }
    }
    const { focus, zoom } = resolveCamera(tree, camera, viewport);
    setCamera((c) => ({ ...c, pan: clampPan({ x: d.px + dx, y: d.py + dy }, zoom, focus, tree) }));
    setDragging(true);
  };

  const panUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    try {
      d.el.releasePointerCapture(d.pid);
    } catch {
      // 캡처하지 않은 포인터
    }
    if (d.moved) {
      justDragged.current = true;
      setDragging(false);
      setTimeout(() => { justDragged.current = false; }, 0);
    }
  };

  const panClickGuard = (e: ReactMouseEvent) => {
    if (!justDragged.current) return;
    e.preventDefault();
    e.stopPropagation();
    justDragged.current = false;
  };

  // ── 키보드 ──
  const vpKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== ' ' && e.code !== 'Space') return;
    e.preventDefault(); // 스크롤·버튼 눌림 방지
    if (!spaceDown.current) {
      spaceDown.current = true;
      setSpaceHeld(true);
      setStatus('Space를 누른 채 카드를 클릭하면 그 카드 기준으로 검색해요');
    }
  };

  const vpKeyUp = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== ' ' && e.code !== 'Space') return;
    e.preventDefault();
    spaceDown.current = false;
    setSpaceHeld(false);
  };

  const vpBlur = (e: ReactFocusEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setTimeout(() => {
      if (!el.contains(document.activeElement) && spaceDown.current) {
        spaceDown.current = false;
        setSpaceHeld(false);
      }
    }, 0);
  };

  // 맵 위에 마우스를 올리면 맵이 키 입력을 받도록 포커스를 가져온다 (카드에 포커스가 있으면 그대로 둔다)
  const vpEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el.contains(document.activeElement)) el.focus({ preventScroll: true });
  };

  const nodeClick = (id: string) => (e: ReactMouseEvent<HTMLButtonElement>) => {
    // Space를 누른 채 클릭하면 검색 (선택은 바꾸지 않는다)
    if (spaceDown.current) {
      if (e.detail <= 1) void research(id);
      return;
    }
    if (e.detail >= 2) {
      // 더블클릭의 두 번째 클릭: 첫 클릭의 선택을 되돌리고 가운데로 이동
      if (e.detail === 2) toggleSelect(id);
      if (detailId) openDetail(id);
      else center(id);
      return;
    }
    toggleSelect(id);
  };

  const nodeKeyDown = (id: string) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    // 키보드만 쓰는 경우: 카드에 포커스를 두고 Shift+Enter로 검색
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) void research(id);
    }
  };

  // ── 그리기 값 ────────────────────────────────────────────────────
  const { focus, zoom, pan } = resolveCamera(tree, camera, viewport);
  const focusId = focus.id;
  const focusAnc = ancestors(tree, focusId);
  const liveSel = sel.filter((k) => tree.nodes[k]);
  const selCount = liveSel.length;
  const evIndex = new Map(liveSel.map((k, i) => [k, i + 1]));
  const detailNode = detailId ? tree.nodes[detailId] ?? null : null;
  const keywordsVisible = showsKeywords(tree);
  const keywords = keywordsVisible ? keywordSlots(tree.nodes.root.news.keywords) : [];
  const rings = ringPaths(tree, focusId);
  const edges = edgePaths(tree);

  // 궤도 회전: 가운데 카드의 1궤도가 가장 빠르고, 멀어질수록 느려진다.
  const ringAnim = (b: number) => {
    if (b >= orbitRotating || orbitSpeed <= 0) return 'none';
    return `orbitSpin ${((8 * 1.9 ** b) / orbitSpeed).toFixed(2)}s linear infinite`;
  };

  // 리포트: 근거 카드들이 왼쪽 영역에 모두 보이게
  let reportCam: string | null = null;
  if (reportOpen && liveSel.length) {
    let rx0 = Infinity, rx1 = -Infinity, ry0 = Infinity, ry1 = -Infinity;
    for (const k of liveSel) {
      const n = tree.nodes[k];
      const h = sizeOf(n) / 2;
      rx0 = Math.min(rx0, n.x - h); rx1 = Math.max(rx1, n.x + h);
      ry0 = Math.min(ry0, n.y - h); ry1 = Math.max(ry1, n.y + h);
    }
    const minS = Math.min(...liveSel.map((k) => sizeOf(tree.nodes[k])));
    const rz = Math.min(geo.reportFit.w / (rx1 - rx0), geo.reportFit.h / (ry1 - ry0), 260 / minS);
    reportCam = `translate(${geo.reportCx}px, ${viewport.height / 2 + 14}px) scale(${rz.toFixed(4)}) translate(${(-(rx0 + rx1) / 2).toFixed(2)}px, ${(-(ry0 + ry1) / 2).toFixed(2)}px)`;
  }
  const camTransform = reportCam
    ?? (detailNode
      // 상세: 카드가 패널 왼쪽 영역 가운데에서 300px로 보이도록 확대
      ? `translate(${geo.detailCx}px, ${geo.cy}px) scale(${(300 / sizeOf(detailNode)).toFixed(4)}) translate(${(-detailNode.x).toFixed(2)}px, ${(-detailNode.y).toFixed(2)}px)`
      : `translate(${(geo.cx + pan.x).toFixed(1)}px, ${(geo.cy + pan.y).toFixed(1)}px) scale(${zoom.toFixed(4)}) translate(${(-focus.x).toFixed(2)}px, ${(-focus.y).toFixed(2)}px)`);
  const camTransition = dragging ? 'none' : wheeling ? 'transform 90ms linear' : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';

  // 미니맵: 전체 노드와 현재 화면 영역
  const mini = miniMap(tree, {
    x0: focus.x + (0 - geo.cx - pan.x) / zoom,
    x1: focus.x + (viewport.width - geo.cx - pan.x) / zoom,
    y0: focus.y + (0 - geo.cy - pan.y) / zoom,
    y1: focus.y + (viewport.height - geo.cy - pan.y) / zoom,
  });
  const miniJump = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = mini.x0 + ((e.clientX - r.left) / r.width) * 204 / mini.scale;
    const wy = mini.y0 + ((e.clientY - r.top) / r.height) * 120 / mini.scale;
    setCamera((c) => ({ ...c, pan: clampPan({ x: -zoom * (wx - focus.x), y: -zoom * (wy - focus.y) }, zoom, focus, tree) }));
  };

  // 셸에 알리는 값
  const panel: NewsMapPanel = reportOpen ? 'report' : detailNode ? 'detail' : 'none';
  const chip = reportOpen ? '레포트' : detailNode ? '뉴스 자세히 보기' : '뉴스맵';
  useEffect(() => {
    onChrome({ chip, status, panel });
  }, [chip, status, panel, onChrome]);

  // 상세 패널 내용 (닫히는 동안에도 마지막 카드 내용을 유지)
  const shown: MapNode = detailNode ?? (lastDetailId ? tree.nodes[lastDetailId] : undefined) ?? tree.nodes.root;
  const shownSelected = sel.includes(shown.id);

  const evidence = liveSel.map((k) => tree.nodes[k]);
  const reportReady = reportPhase >= 3 && report !== null;
  const steps = [`근거 뉴스 ${selCount}건 본문 추출`, '사건·시장 영향 분석', '종목·전략 정리'];

  return (
    <div className="news-explorer" ref={fieldRef}>
      <div
        ref={viewportRef}
        className={`explorer-viewport${spaceHeld ? ' space-mode' : ''}${dragging ? ' is-dragging' : ''}`}
        tabIndex={-1}
        aria-label="뉴스맵 캔버스 — 끌어서 이동, 휠로 확대·축소"
        onKeyDown={vpKeyDown}
        onKeyUp={vpKeyUp}
        onBlur={vpBlur}
        onPointerEnter={vpEnter}
        onPointerDown={panDown}
        onPointerMove={panMove}
        onPointerUp={panUp}
        onPointerCancel={panUp}
        onClickCapture={panClickGuard}
      >
        <div className="explorer-camera" style={{ transform: camTransform, transition: camTransition }}>
          <svg className="explorer-lines" width="4000" height="4000" viewBox="-2000 -2000 4000 4000" aria-hidden="true">
            {[5, 4, 3, 2, 1, 0].map((b) => (
              <path
                key={b}
                className="map-orbit"
                d={rings[b] || 'M0 0'}
                style={{ strokeOpacity: RING_OPACITY[b], strokeWidth: RING_WIDTH[b], animation: ringAnim(b) }}
              />
            ))}
            <path className="map-keyword-edges" d={keywordEdgePaths(keywords.length) || 'M0 0'} />
            <path className="map-edges" d={edges || 'M0 0'} />
          </svg>

          {keywords.map((slot) => (
            <button
              key={slot.keyword}
              type="button"
              className="map-keyword"
              style={{ left: slot.x - KEYWORD_SIZE / 2, top: slot.y - KEYWORD_SIZE / 2 }}
              onClick={() => onOpenKeyword(slot.keyword)}
              aria-label={`${slot.keyword} 키워드맵 열기`}
            >
              {slot.keyword}
            </button>
          ))}

          {tree.order.map((id) => {
            const n = tree.nodes[id];
            const s = sizeOf(n);
            const base = baseOf(n);
            const isRoot = n.level === 0;
            const selected = sel.includes(id);
            const isLoadingChild = loadingId !== null && n.parent === loadingId;
            let isFocus = detailNode ? id === detailNode.id : id === focusId;
            // 초점 카드의 조상·형제·자손만 또렷하게, 나머지 가지는 흐리게
            const inPath = isFocus
              || focusAnc.has(id)
              || (n.parent !== null && (focusAnc.has(n.parent) || n.parent === focusId))
              || ancestors(tree, id).has(focusId);
            if (reportOpen) isFocus = evIndex.has(id);
            const ring = isLoadingChild
              ? '1px dashed var(--accent-border)'
              : isFocus ? '3px solid var(--brand)' : n.expanded ? '2px solid var(--accent)' : '1px solid var(--node-border)';
            const opacity = reportOpen ? (evIndex.has(id) ? 1 : 0.18) : isLoadingChild ? 0.45 : inPath ? 1 : 0.3;
            const evNo = reportOpen ? evIndex.get(id) : undefined;

            return (
              <div
                key={id}
                className="map-node"
                style={{ left: n.x - s / 2, top: n.y - s / 2, width: s, height: s, opacity }}
              >
                <div className="map-node-scale" style={{ width: base, height: base, transform: `scale(${(s / base).toFixed(4)})` }}>
                  <div className="map-node-pop">
                    <button
                      type="button"
                      className={`map-card${isRoot ? ' is-root' : ''}${selected ? ' is-selected' : ''}`}
                      data-node-id={id}
                      style={{ border: ring }}
                      onClick={nodeClick(id)}
                      onKeyDown={nodeKeyDown(id)}
                      aria-pressed={selected}
                      aria-label={`${n.news.title} — 클릭 선택, 더블클릭 가운데로, Space를 누른 채 클릭(키보드는 Shift+Enter) 검색`}
                    >
                      <span className="map-card-thumb" style={{ background: `var(--tone-${n.news.thumbnailTone})` }} />
                      <span className="map-card-copy">
                        <strong>{isLoadingChild ? '다시 검색하는 중…' : n.news.title}</strong>
                        <small>{isLoadingChild ? '' : n.news.source}</small>
                      </span>
                    </button>
                    {selected && (
                      <span className="map-card-badge" aria-hidden="true">
                        {evNo ?? <Check size={16} strokeWidth={3} />}
                      </span>
                    )}
                    <button
                      type="button"
                      className="map-card-detail"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(id);
                      }}
                      aria-label={`${n.news.title} 상세 보기`}
                    >
                      상세
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PremiumPreview />

      {selCount > 0 && !reportOpen && (
        <div
          className="selection-tray"
          role="region"
          aria-label="선택한 뉴스"
          style={{ left: detailNode ? geo.detailCx : '50%' }}
        >
          <span className="tray-count">
            <span className="tray-badge">{selCount}</span>건 선택됨
          </span>
          <button type="button" className="btn-ghost" onClick={clearSel}>선택 해제</button>
          <button type="button" className="btn-brand" onClick={() => openReport(null)}>
            <FileText size={14} aria-hidden="true" />
            선택한 뉴스로 리포트 만들기
          </button>
        </div>
      )}

      <div className="map-help" aria-label="조작 방법">
        <strong>클릭</strong><span>카드 선택·해제</span>
        <strong>더블클릭</strong><span>가운데로 이동</span>
        <strong>Space + 클릭</strong><span>그 카드 기준 검색 (하위 뉴스 펼치기·재검색)</span>
        <strong>휠</strong><span>확대·축소</span>
        <strong>끌기</strong><span>화면 이동</span>
      </div>

      <button type="button" className="map-reset btn-ghost" onClick={reset} aria-label="처음 뉴스맵으로">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
        <span>처음 뉴스맵으로</span>
      </button>

      <div className="map-minimap" aria-label="미니맵">
        <div className="map-minimap-head">
          <span>미니맵</span>
          <span>×{Math.round(zoom * 100) / 100}</span>
        </div>
        <button type="button" onClick={miniJump} aria-label="미니맵 — 누른 위치로 화면 이동">
          <svg width="204" height="120" viewBox="0 0 204 120" aria-hidden="true">
            <path d={mini.edges || 'M0 0'} />
          </svg>
          {mini.dots.map((dot) => {
            const n = tree.nodes[dot.id];
            const strong = dot.id === focusId || sel.includes(dot.id);
            return (
              <span
                key={dot.id}
                className="map-minimap-dot"
                style={{
                  left: dot.x - dot.size / 2,
                  top: dot.y - dot.size / 2,
                  width: dot.size,
                  height: dot.size,
                  background: strong ? 'var(--brand)' : n.expanded ? 'var(--accent)' : 'var(--text-tertiary)',
                  opacity: strong || n.expanded ? 1 : 0.55,
                }}
              />
            );
          })}
          <span
            className="map-minimap-view"
            style={{ left: mini.view.x, top: mini.view.y, width: mini.view.w, height: mini.view.h }}
          />
        </button>
      </div>

      <aside
        ref={detailRef}
        className={`news-sheet detail-sheet${detailNode ? ' is-open' : ''}`}
        aria-label="뉴스 자세히 보기"
        aria-hidden={!detailNode}
      >
        <div className="detail-sheet-hero" style={{ background: `var(--tone-${shown.news.thumbnailTone})` }}>
          <div className="detail-sheet-shade" />
          <Newspaper size={40} aria-hidden="true" />
          <button type="button" className="sheet-close on-image" onClick={closeDetail} aria-label="상세 닫기 (Esc)">
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <div className="detail-sheet-body">
          <div className="sheet-source">
            <span>{shown.news.source}</span>
            <span>{shown.news.publishedAt || '[발행 시각]'}</span>
          </div>
          <h2>{shown.news.title}</h2>
          <div className="sheet-section">
            <h3>기사 설명</h3>
            <p className={shown.news.summary ? undefined : 'is-placeholder'}>
              {shown.news.summary || '[기사 설명 — NAVER 검색 결과의 description이 여기에 표시됩니다]'}
            </p>
          </div>
          {/* 원문 URL이 없으면 일반 주소로 대신하지 않고 링크를 숨긴다 (docs/10 § 3.4) */}
          {shown.news.sourceUrl && (
            <div className="sheet-link">
              <span>원문 링크</span>
              <a href={shown.news.sourceUrl} target="_blank" rel="noreferrer">
                {shown.news.sourceUrl}
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
          )}
          <div className="sheet-tags">
            {shown.news.keywords.map((kw) => <span key={kw}>{kw}</span>)}
          </div>
          <div className="sheet-actions">
            <button
              type="button"
              className={`sheet-select${shownSelected ? ' is-selected' : ''}`}
              aria-pressed={shownSelected}
              onClick={() => toggleSelect(shown.id)}
            >
              <Check size={16} strokeWidth={2.6} aria-hidden="true" />
              {shownSelected ? '리포트 근거로 선택됨' : '리포트 근거로 선택'}
            </button>
            <button type="button" className="sheet-report btn-brand" onClick={() => openReport(shown.id)}>
              <FileText size={18} aria-hidden="true" />
              {selCount > 0 ? `선택한 ${selCount}건으로 리포트` : '이 뉴스로 리포트'}
            </button>
          </div>
        </div>
      </aside>

      <aside
        className={`news-sheet report-sheet${reportOpen ? ' is-open' : ''}`}
        aria-label="AI 리포트"
        aria-hidden={!reportOpen}
      >
        <div className="report-sheet-head">
          <div>
            <span>AI REPORT · 근거 뉴스 {selCount}건</span>
            <h2>{reportTitle(map, evidence.map((n) => n.news), reportReady ? report : null)}</h2>
          </div>
          <button type="button" className="sheet-close" onClick={closeReport} aria-label="리포트 닫기 (Esc)">
            <X size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        <div className="report-sheet-body">
          <section className="report-evidence" aria-label="근거 뉴스">
            <h3>근거 뉴스</h3>
            {evidence.map((n, i) => (
              <div key={n.id} className="evidence-row">
                <span className="evidence-no">{i + 1}</span>
                <span className="evidence-thumb" style={{ background: `var(--tone-${n.news.thumbnailTone})` }} />
                <span className="evidence-copy">
                  <strong>{n.news.title}</strong>
                  <small>{n.news.source}{n.news.publishedAt ? ` · ${n.news.publishedAt}` : ''}</small>
                </span>
                <button type="button" onClick={() => toggleSelect(n.id)} aria-label={`${n.news.title} 근거에서 빼기`}>
                  빼기
                </button>
              </div>
            ))}
            <p>뉴스맵에서 카드를 클릭해 근거를 더하거나 뺄 수 있어요. 근거가 바뀌면 리포트를 다시 만들어요.</p>
          </section>

          {!reportReady && (
            <section className="report-steps" role="status" aria-label="리포트 생성 중">
              {steps.map((label, i) => (
                <div key={label} className={`report-step${reportPhase >= i ? ' is-reached' : ''}`}>
                  {reportPhase > i && (
                    <span className="step-done"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>
                  )}
                  {reportPhase === i && <span className="step-active" />}
                  {reportPhase < i && <span className="step-wait" />}
                  <span>{label}</span>
                </div>
              ))}
            </section>
          )}

          {reportReady && report && (
            <>
              <section className="report-text">
                <h3>사건 요약</h3>
                <p>{report.eventSummary}</p>
              </section>
              <section className="report-text">
                <h3>시장 영향</h3>
                <p>{report.marketImpact}</p>
              </section>
              <section className="report-stocks" aria-label="종목 영향">
                {report.stockImpacts.map((stock, i) => (
                  <article key={`${stock.name}-${i}`} className={`report-stock ${stock.direction}`}>
                    <div>
                      <strong>{stock.name}</strong>
                      <span>{stock.actionLabel ?? DIRECTION_LABEL[stock.direction]}</span>
                    </div>
                    {stock.symbol && <span className="report-stock-ticker">{stock.symbol}</span>}
                    {stock.impact && <p>{stock.impact}</p>}
                  </article>
                ))}
              </section>
              {/* 전략 성과 차트는 실제 시세·백테스트 데이터가 없어 표시하지 않는다 (docs/10 D5) */}
              {report.strategySummary && (
                <section className="report-strategy">
                  <div className="report-stance">
                    <LineChart size={22} aria-hidden="true" />
                    <strong>{report.strategySummary.stance}</strong>
                    <p>{report.strategySummary.rationale}</p>
                  </div>
                </section>
              )}
              <section className="report-text">
                <h3>리스크 요인</h3>
                <div className="sheet-tags">
                  {report.riskFactors.map((risk) => <span key={risk}>{risk}</span>)}
                </div>
                {report.strategySummary?.riskWarning && (
                  <p className="report-warning">{report.strategySummary.riskWarning}</p>
                )}
              </section>
              <p className="report-disclaimer">
                {USE_MOCK
                  ? `리포트 본문은 목업 데이터(${map.reportLabel})예요. 실제 서비스에서는 위 근거 뉴스 ${selCount}건의 본문을 추출해 생성합니다. `
                  : `위 근거 뉴스 ${selCount}건을 바탕으로 AI가 생성했어요.${report.descriptionOnlyCount ? ` 그중 ${report.descriptionOnlyCount}건은 본문을 가져오지 못해 기사 설명만 사용했어요.` : ''}${report.isFallback ? ' AI 분석을 만들지 못해 대체 문구를 표시하고 있어요.' : ''} `}
                투자 권유가 아닌 판단 참고 자료입니다.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

/** 헤더 가운데 상태 표시 (뉴스맵 화면) */
export function NewsMapStatusPill({ text }: { text: string }) {
  return (
    <div className="map-status-pill" role="status">
      <RotateCcw size={14} aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
