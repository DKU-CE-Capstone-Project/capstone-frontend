import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowLeft,
  FileText,
  LineChart,
  Lock,
  Newspaper,
  Search,
} from 'lucide-react';
import {
  clusters,
  newsCards as staticNewsCards,
  type IssueCluster,
  type NewsCard,
  type Report,
} from './data/mockData';
import {
  dynNews,
  fetchAndCacheCluster,
  findOrResolveClusterByQuery,
  resolveCluster,
  resolveNews,
  resolveReport,
} from './data/apiAdapter';

type Screen = 'home' | 'searchResults' | 'newsMap' | 'newsDetail' | 'report';

const PROJECT_TITLE = '실시간 뉴스 기반 멀티 에이전트 투자 판단 지원 시스템';

const viewNames: Record<Screen, string> = {
  home: '검색창',
  searchResults: '검색된 키워드 뉴스',
  newsMap: '뉴스맵',
  newsDetail: '뉴스 자세히 보기',
  report: '레포트',
};

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [history, setHistory] = useState<Screen[]>([]);
  const [query, setQuery] = useState('');
  const [activeClusterId, setActiveClusterId] = useState(clusters[0].id);
  const [centerNewsId, setCenterNewsId] = useState(clusters[0].mainNewsId);
  const [detailNewsId, setDetailNewsId] = useState(clusters[0].mainNewsId);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeCluster = resolveCluster(activeClusterId);
  const visibleNews = useMemo(
    () => getVisibleNews(activeCluster, centerNewsId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCluster, centerNewsId, activeClusterId],
  );
  const centerNews = resolveNews(centerNewsId);
  const report = resolveReport(activeCluster.reportId);

  const navigate = (nextScreen: Screen) => {
    setHistory((prev) => [...prev, screen]);
    setScreen(nextScreen);
  };

  const goBack = () => {
    setHistory((prev) => {
      const next = [...prev];
      const prevScreen = next.pop();
      setScreen(prevScreen ?? 'home');
      return next;
    });
  };

  /** Resolve cluster from term — tries API first, falls back to static mock */
  const loadCluster = async (term: string): Promise<IssueCluster> => {
    const trimmed = term.trim();
    if (!trimmed) return findOrResolveClusterByQuery('');

    // If static mock has a match, use it immediately (no network call)
    const staticMatch = clusters.find(
      (c) =>
        c.query.toLowerCase().includes(trimmed.toLowerCase()) ||
        c.recommendedKeywords.some((k) => k.toLowerCase().includes(trimmed.toLowerCase())),
    );
    if (staticMatch) return staticMatch;

    // Otherwise hit the API
    return fetchAndCacheCluster(trimmed);
  };

  const openCluster = async (term: string) => {
    const trimmed = term.trim();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const nextCluster = await loadCluster(trimmed);
      setQuery(trimmed || nextCluster.query);
      setActiveClusterId(nextCluster.id);
      setCenterNewsId(nextCluster.mainNewsId);
      setDetailNewsId(nextCluster.mainNewsId);
      navigate('searchResults');
    } catch (e) {
      // API failed — fall back to static mock
      const fallback = findOrResolveClusterByQuery(trimmed);
      setQuery(trimmed || fallback.query);
      setActiveClusterId(fallback.id);
      setCenterNewsId(fallback.mainNewsId);
      setDetailNewsId(fallback.mainNewsId);
      setErrorMsg('API 호출 실패 — 기본 데이터로 표시합니다.');
      navigate('searchResults');
    } finally {
      setIsLoading(false);
    }
  };

  const openNewsMap = (newsId: string) => {
    setCenterNewsId(newsId);
    setDetailNewsId(newsId);
    navigate('newsMap');
  };

  const openKeywordNewsMap = async (term: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const nextCluster = await loadCluster(term);
      setQuery(term || nextCluster.query);
      setActiveClusterId(nextCluster.id);
      setCenterNewsId(nextCluster.mainNewsId);
      setDetailNewsId(nextCluster.mainNewsId);
      navigate('newsMap');
    } catch {
      const fallback = findOrResolveClusterByQuery(term);
      setActiveClusterId(fallback.id);
      setCenterNewsId(fallback.mainNewsId);
      setDetailNewsId(fallback.mainNewsId);
      navigate('newsMap');
    } finally {
      setIsLoading(false);
    }
  };

  const openDetail = (newsId: string) => {
    setDetailNewsId(newsId);
    navigate('newsDetail');
  };

  const openReport = () => {
    navigate('report');
  };

  return (
    <main className="app-shell">
      {isLoading && <LoadingOverlay />}
      <section className={`prototype-frame screen-${screen}`} aria-label="뉴스맵 클릭모형">
        <HeaderBar screen={screen} />

        {screen === 'home' && (
          <HomeView
            query={query}
            setQuery={setQuery}
            onSearch={() => openCluster(query)}
            onKeyword={openCluster}
          />
        )}

        {screen === 'searchResults' && (
          <SearchResultsView
            cluster={activeCluster}
            errorMsg={errorMsg}
            onOpenNewsMap={openNewsMap}
            onOpenKeywordNewsMap={openKeywordNewsMap}
          />
        )}

        {screen === 'newsMap' && (
          <NewsMapView
            centerNews={centerNews}
            relatedNews={visibleNews}
            onOpenDetail={openDetail}
            onOpenReport={openReport}
          />
        )}

        {screen === 'newsDetail' && (
          <DetailView
            centerNews={centerNews}
            detailNews={resolveNews(detailNewsId)}
            relatedNews={visibleNews}
            onOpenDetail={openDetail}
            onOpenReport={openReport}
          />
        )}

        {screen === 'report' && (
          <ReportView
            centerNews={centerNews}
            relatedNews={visibleNews}
            report={report}
            onOpenDetail={openDetail}
          />
        )}

        {screen !== 'home' && (
          <BottomControls
            screen={screen}
            canGoBack={history.length > 0}
            onBack={goBack}
            onSearch={() => navigate('home')}
            onReport={openReport}
          />
        )}
      </section>
    </main>
  );
}

// ── Loading overlay ──────────────────────────────────────────────────────────
function LoadingOverlay() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(239,239,239,0.72)',
        backdropFilter: 'blur(4px)',
      }}
      aria-live="polite"
      aria-label="뉴스 분석 중"
    >
      <div
        style={{
          padding: '20px 32px',
          borderRadius: 12,
          background: '#fff',
          border: '1px solid #ddd',
          fontWeight: 700,
          color: '#3c4149',
          fontSize: 15,
        }}
      >
        🔍 뉴스 분석 중…
      </div>
    </div>
  );
}

// ── HeaderBar ────────────────────────────────────────────────────────────────
function HeaderBar({ screen }: { screen: Screen }) {
  return (
    <header className="header-bar">
      <div className="header-spacer" aria-hidden="true" />
      <div className="view-chip">{viewNames[screen]}</div>
    </header>
  );
}

// ── HomeView ─────────────────────────────────────────────────────────────────
function HomeView({
  query,
  setQuery,
  onSearch,
  onKeyword,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  onKeyword: (kw: string) => void;
}) {
  const keywords = clusters[0].recommendedKeywords;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <section className="home-view view-surface">
      <div className="logo-mark">{PROJECT_TITLE}</div>
      <form className="search-form" onSubmit={submit}>
        <Search aria-hidden="true" size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="뉴스 키워드 검색"
          aria-label="뉴스 키워드 검색"
        />
        <button type="submit">검색</button>
      </form>
      <div className="keyword-row" aria-label="추천 키워드">
        {keywords.map((kw) => (
          <button key={kw} type="button" onClick={() => onKeyword(kw)}>
            {kw}
          </button>
        ))}
      </div>
      <div className="home-footer">
        <span>추천 이슈</span>
        <strong>중동 전황 · AI 서버 · 환율</strong>
      </div>
    </section>
  );
}

// ── SearchResultsView ────────────────────────────────────────────────────────
function SearchResultsView({
  cluster,
  errorMsg,
  onOpenNewsMap,
  onOpenKeywordNewsMap,
}: {
  cluster: IssueCluster;
  errorMsg: string | null;
  onOpenNewsMap: (newsId: string) => void;
  onOpenKeywordNewsMap: (kw: string) => void;
}) {
  const keywordNodes = getSearchKeywordNodes(cluster);

  return (
    <section className="results-view view-surface">
      {errorMsg && (
        <div
          style={{
            position: 'absolute',
            top: 72,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            color: '#6b5a00',
            zIndex: 10,
          }}
        >
          {errorMsg}
        </div>
      )}
      <div className="orbit-field">
        <div className="orbit orbit-large" />
        <div className="orbit orbit-small" />
        {keywordNodes.map((node, i) => (
          <button
            key={`${node.keyword}-${i}`}
            type="button"
            className={`keyword-map-node keyword-map-node-${i}`}
            onClick={() =>
              node.newsId ? onOpenNewsMap(node.newsId) : onOpenKeywordNewsMap(node.keyword)
            }
            aria-label={`${node.keyword} 관련 뉴스 보기`}
          >
            {node.keyword}
          </button>
        ))}
      </div>
      <div className="result-search-strip">
        <Search size={16} aria-hidden="true" />
        <span>{cluster.query}</span>
        <button type="button" onClick={() => onOpenNewsMap(cluster.mainNewsId)}>
          열기
        </button>
      </div>
    </section>
  );
}

// ── NewsMapView ───────────────────────────────────────────────────────────────
function NewsMapView({
  centerNews,
  relatedNews,
  onOpenDetail,
  onOpenReport,
}: {
  centerNews: NewsCard;
  relatedNews: NewsCard[];
  onOpenDetail: (newsId: string) => void;
  onOpenReport: () => void;
}) {
  return (
    <section className="map-view view-surface">
      <NewsMapCanvas
        centerNews={centerNews}
        relatedNews={relatedNews}
        onOpenDetail={onOpenDetail}
      />
      <PremiumPreview />
      <button type="button" className="floating-report" onClick={onOpenReport}>
        <FileText size={18} aria-hidden="true" />
        리포트
      </button>
    </section>
  );
}

// ── DetailView ────────────────────────────────────────────────────────────────
function DetailView({
  centerNews,
  detailNews,
  relatedNews,
  onOpenDetail,
  onOpenReport,
}: {
  centerNews: NewsCard;
  detailNews: NewsCard;
  relatedNews: NewsCard[];
  onOpenDetail: (newsId: string) => void;
  onOpenReport: () => void;
}) {
  return (
    <section className="split-view view-surface">
      <aside className="mini-map">
        <NewsMapCanvas
          centerNews={centerNews}
          relatedNews={relatedNews}
          compact
          onOpenDetail={onOpenDetail}
        />
      </aside>
      <article className="detail-panel">
        <div className={`story-hero tone-${detailNews.thumbnailTone}`}>
          <img src={detailNews.imageUrl} alt={`${detailNews.title} 대표 이미지`} />
          <div className="story-hero-overlay" aria-hidden="true" />
          <Newspaper size={40} aria-hidden="true" />
        </div>
        <div className="panel-content">
          <div className="source-line">
            <span>{detailNews.source}</span>
            <time>{detailNews.publishedAt}</time>
          </div>
          <h2>{detailNews.title}</h2>
          <p className="lead">{detailNews.summary}</p>
          <p>{detailNews.mockOriginalBody}</p>
          <div className="tag-list">
            {detailNews.keywords.map((kw) => (
              <span key={kw}>{kw}</span>
            ))}
          </div>
          <button type="button" className="primary-action" onClick={onOpenReport}>
            <FileText size={18} aria-hidden="true" />
            리포트 보기
          </button>
        </div>
      </article>
    </section>
  );
}

// ── ReportView ────────────────────────────────────────────────────────────────
function ReportView({
  centerNews,
  relatedNews,
  report,
  onOpenDetail,
}: {
  centerNews: NewsCard;
  relatedNews: NewsCard[];
  report: Report;
  onOpenDetail: (newsId: string) => void;
}) {
  return (
    <section className="split-view report-view view-surface">
      <aside className="mini-map report-map">
        <NewsMapCanvas
          centerNews={centerNews}
          relatedNews={relatedNews}
          compact
          onOpenDetail={onOpenDetail}
        />
      </aside>
      <article className="report-panel">
        <div className="panel-content">
          <div className="source-line">
            <span>AI Report</span>
            <time>실시간 뉴스 기반 분석</time>
          </div>
          <h2>{report.title}</h2>
          <section className="report-block">
            <h3>사건 요약</h3>
            <p>{report.eventSummary}</p>
          </section>
          <section className="report-block">
            <h3>시장 영향</h3>
            <p>{report.marketImpact}</p>
          </section>
          {report.stockImpacts.length > 0 && (
            <section className="impact-grid" aria-label="종목 영향">
              {report.stockImpacts.map((stock) => (
                <article key={stock.symbol} className={`impact-card ${stock.direction}`}>
                  <strong>{stock.name}</strong>
                  <span>{stock.symbol}</span>
                  <p>{stock.impact}</p>
                </article>
              ))}
            </section>
          )}
          <section className="chart-block">
            <MiniChart />
            <div className="strategy-box">
              <LineChart size={22} aria-hidden="true" />
              <div>
                <strong>{report.strategySummary.stance}</strong>
                <p>{report.strategySummary.rationale}</p>
              </div>
            </div>
          </section>
          <section className="report-block">
            <h3>리스크 요인</h3>
            <div className="tag-list">
              {report.riskFactors.map((risk) => (
                <span key={risk}>{risk}</span>
              ))}
            </div>
          </section>
          <PremiumPreview dense />
        </div>
      </article>
    </section>
  );
}

// ── NewsMapCanvas ─────────────────────────────────────────────────────────────
function NewsMapCanvas({
  centerNews,
  relatedNews,
  compact = false,
  onOpenDetail,
}: {
  centerNews: NewsCard;
  relatedNews: NewsCard[];
  compact?: boolean;
  onOpenDetail: (newsId: string) => void;
}) {
  return (
    <div className={`news-map-canvas${compact ? ' compact' : ''}`}>
      <svg className="connection-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M50 51 C42 55, 35 63, 27 71" />
        <path d="M57 43 C63 34, 69 26, 76 21" />
        <path d="M57 58 C64 66, 70 72, 76 79" />
      </svg>
      <NewsNode news={centerNews} variant="center" onOpenDetail={onOpenDetail} />
      {relatedNews.map((news, i) => (
        <NewsNode
          key={news.id}
          news={news}
          variant={`related related-${i}` as const}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
}

// ── NewsNode ──────────────────────────────────────────────────────────────────
function NewsNode({
  news,
  variant,
  onOpenDetail,
}: {
  news: NewsCard;
  variant: 'center' | `related related-${number}`;
  onOpenDetail: (newsId: string) => void;
}) {
  return (
    <article
      className={`news-node ${variant} tone-${news.thumbnailTone}`}
      aria-label={`${news.title} 뉴스 노드`}
    >
      <img className="node-image" src={news.imageUrl} alt={`${news.title} 대표 이미지`} />
      <div className="node-copy">
        <strong>{news.title}</strong>
        <small>{news.source}</small>
      </div>
      <button
        type="button"
        className="detail-link"
        onClick={() => onOpenDetail(news.id)}
        aria-label={`${news.title} 상세 보기`}
      >
        상세
      </button>
    </article>
  );
}

// ── PremiumPreview ────────────────────────────────────────────────────────────
function PremiumPreview({ dense = false }: { dense?: boolean }) {
  return (
    <aside className={`premium-preview${dense ? ' dense' : ''}`} aria-label="유료 기능 프리뷰">
      <div>
        <Lock size={16} aria-hidden="true" />
        <strong>유료 프리뷰</strong>
      </div>
      <button type="button" disabled>뉴스 선택/제외</button>
      <button type="button" disabled>연관도 상세</button>
      <button type="button" disabled>심화 리포트</button>
    </aside>
  );
}

// ── BottomControls ────────────────────────────────────────────────────────────
function BottomControls({
  screen,
  canGoBack,
  onBack,
  onSearch,
  onReport,
}: {
  screen: Screen;
  canGoBack: boolean;
  onBack: () => void;
  onSearch: () => void;
  onReport: () => void;
}) {
  return (
    <nav className="bottom-controls" aria-label="화면 컨트롤">
      <button type="button" onClick={onBack} disabled={!canGoBack} aria-label="뒤로가기">
        <ArrowLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onReport}
        disabled={screen === 'home' || screen === 'searchResults'}
        aria-label="리포트"
      >
        <FileText aria-hidden="true" />
      </button>
      <button type="button" onClick={onSearch} aria-label="검색">
        <Search aria-hidden="true" />
      </button>
    </nav>
  );
}

// ── MiniChart ─────────────────────────────────────────────────────────────────
function MiniChart() {
  return (
    <div className="mini-chart" aria-label="전략 성과 목업 차트">
      {[34, 62, 48, 74, 56, 82, 68].map((h, i) => (
        <span key={`${h}-${i}`} style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

// ── Pure utility functions ────────────────────────────────────────────────────
function getSearchKeywordNodes(cluster: IssueCluster) {
  const clusterNews = [cluster.mainNewsId, ...cluster.relatedNewsIds].map(resolveNews);
  const nodes: Array<{ keyword: string; newsId?: string }> = [];
  const seen = new Set<string>();

  const push = (keyword: string, newsId?: string) => {
    if (seen.has(keyword)) return;
    seen.add(keyword);
    nodes.push({ keyword, newsId });
  };

  clusterNews.forEach((news) => push(news.keywords[0], news.id));
  cluster.recommendedKeywords.forEach((kw) => push(kw));

  return nodes.slice(0, 11);
}

function getVisibleNews(cluster: IssueCluster, centerNewsId: string): NewsCard[] {
  const clusterNewsIds = [cluster.mainNewsId, ...cluster.relatedNewsIds];
  const candidates = clusterNewsIds
    .filter((id) => id !== centerNewsId)
    .map(resolveNews);

  if (candidates.length >= 3) return candidates.slice(0, 3);

  // Fallback: combine static + dynamic news cards
  const allNews = [...staticNewsCards, ...Array.from(dynNews.values())];
  const fallback = allNews
    .filter((n) => n.id !== centerNewsId && !candidates.some((c) => c.id === n.id))
    .slice(0, 3 - candidates.length);

  return [...candidates, ...fallback];
}

export default App;
