import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  LineChart,
  Lock,
  Newspaper,
  Search,
} from 'lucide-react';
import { clusters, type IssueCluster, type NewsCard, type Report } from './data/mockData';
import {
  buildFallbackCluster,
  createAndCacheReport,
  errorMessage,
  fetchAndCacheCluster,
  fetchAndCacheNewsCluster,
  fetchAndCacheNewsMap,
  fetchRecommendedKeywordLabels,
  findKnownNews,
  findOrResolveClusterByQuery,
  resolveCluster,
  resolveNews,
  resolveReport,
} from './data/apiAdapter';
import { useTheme } from './design/useTheme';
import { MAX_KEYWORD_NODES, MAX_RELATED_NODES } from './layout/mapLayout';
import {
  easeOut,
  fadeVariants,
  riseVariants,
  screenVariants,
  springSnappy,
  springSoft,
  staggerContainer,
  useMotionSafe,
} from './motion/presets';
import { KeywordMap } from './components/KeywordMap';
import { NewsMapCanvas } from './components/NewsMapCanvas';
import { EmptyState, LoadingOverlay, MapSkeleton, SmartImage, ThemeToggle, Toast } from './components/ui';

type Screen = 'home' | 'searchResults' | 'newsMap' | 'newsDetail' | 'report';

const PROJECT_TITLE = '실시간 뉴스 기반 멀티 에이전트 투자 판단 지원 시스템';

const viewNames: Record<Screen, string> = {
  home: '검색창',
  searchResults: '키워드 맵',
  newsMap: '뉴스맵',
  newsDetail: '뉴스 자세히 보기',
  report: '레포트',
};

function App() {
  const { isDark, toggle: toggleTheme } = useTheme();

  const [screen, setScreen] = useState<Screen>('home');
  const [history, setHistory] = useState<Screen[]>([]);
  const [query, setQuery] = useState('');
  const [activeClusterId, setActiveClusterId] = useState(clusters[0].id);
  const [centerNewsId, setCenterNewsId] = useState(clusters[0].mainNewsId);
  const [detailNewsId, setDetailNewsId] = useState(clusters[0].mainNewsId);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [isExpandingMap, setIsExpandingMap] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /**
   * apiAdapter 의 클러스터 캐시는 모듈 레벨 Map 이라 갱신해도 React 가 모른다.
   * 화면 전환 없이 캐시만 바뀌는 경우(맵 중심 교체)에 다시 읽게 하는 신호.
   */
  const [clusterRevision, setClusterRevision] = useState(0);
  const [recommendedKeywords, setRecommendedKeywords] = useState(
    clusters[0].recommendedKeywords.slice(0, 8),
  );

  const activeCluster = resolveCluster(activeClusterId);
  const visibleNews = useMemo(
    () => getVisibleNews(activeCluster, centerNewsId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCluster, centerNewsId, activeClusterId, clusterRevision],
  );
  const centerNews = resolveNews(centerNewsId);
  const report = resolveReport(activeCluster.reportId);

  useEffect(() => {
    let isMounted = true;
    fetchRecommendedKeywordLabels(8)
      .then((keywords) => {
        if (isMounted && keywords.length > 0) setRecommendedKeywords(keywords);
      })
      .catch(() => {
        if (isMounted) setErrorMsg('추천 키워드 API 호출 실패 — 기본 키워드로 표시합니다.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const navigate = (nextScreen: Screen) => {
    setHistory((prev) => [...prev, screen]);
    setScreen(nextScreen);
  };

  /**
   * 이전 구현은 setHistory 업데이터 안에서 setScreen을 호출했다.
   * 업데이터는 순수해야 하고 StrictMode에서 두 번 실행되므로 상태 갱신을 분리한다.
   */
  const goBack = () => {
    const previous = history[history.length - 1] ?? 'home';
    setHistory((prev) => prev.slice(0, -1));
    setScreen(previous);
  };

  const dismissError = useCallback(() => setErrorMsg(null), []);

  /** 키워드만 있는 맵을 먼저 만든다. 뉴스 검색은 키워드 노드를 열 때까지 미룬다. */
  const loadCluster = async (term: string): Promise<IssueCluster> => {
    const trimmed = term.trim();
    if (!trimmed) return findOrResolveClusterByQuery('');
    return fetchAndCacheCluster(trimmed);
  };

  const openCluster = async (term: string) => {
    const trimmed = term.trim();
    setLoadingLabel('연관 키워드를 찾는 중…');
    setErrorMsg(null);
    try {
      const nextCluster = await loadCluster(trimmed);
      setQuery(trimmed || nextCluster.query);
      setActiveClusterId(nextCluster.id);
      setCenterNewsId(nextCluster.mainNewsId);
      setDetailNewsId(nextCluster.mainNewsId);
      navigate('searchResults');
    } catch {
      // API 실패 — 검색어는 중심에 남기고 키워드만 로컬 데이터로 채운다
      const fallback = buildFallbackCluster(trimmed);
      setQuery(trimmed || fallback.query);
      setActiveClusterId(fallback.id);
      setCenterNewsId(fallback.mainNewsId);
      setDetailNewsId(fallback.mainNewsId);
      setErrorMsg('API 호출 실패 — 기본 데이터로 표시합니다.');
      navigate('searchResults');
    } finally {
      setLoadingLabel(null);
    }
  };

  const openKeywordNewsMap = async (term: string) => {
    setLoadingLabel('관련 뉴스를 모으는 중…');
    setErrorMsg(null);
    try {
      const nextCluster = await fetchAndCacheNewsCluster(term);
      setQuery(term || nextCluster.query);
      setActiveClusterId(nextCluster.id);
      setCenterNewsId(nextCluster.mainNewsId);
      setDetailNewsId(nextCluster.mainNewsId);

      // 검색 결과는 "검색어에 걸린 기사"다. 맵에는 "중심 기사와 이어진 기사"를 건다.
      try {
        setLoadingLabel('연관 뉴스를 잇는 중…');
        await loadNeighbours(nextCluster.mainNewsId, nextCluster.id);
      } catch {
        // graph/related 실패 — 검색 결과로 만든 연관 목록을 그대로 쓴다
      }

      navigate('newsMap');
    } catch (error) {
      setQuery(term);
      setCenterNewsId('');
      setDetailNewsId('');
      setErrorMsg(errorMessage(error, '뉴스 검색에 실패했습니다.', '잠시 후 다시 검색해 주세요.'));
      navigate('newsMap');
    } finally {
      setLoadingLabel(null);
    }
  };

  const openDetail = (newsId: string) => {
    setErrorMsg(null);
    setDetailNewsId(newsId);
    if (screen !== 'newsDetail') navigate('newsDetail');
  };

  const openReport = async () => {
    setLoadingLabel('리포트를 생성하는 중…');
    setErrorMsg(null);
    try {
      const selectedId = screen === 'newsDetail' ? detailNewsId : centerNewsId;
      const relatedIds = [activeCluster.mainNewsId, ...activeCluster.relatedNewsIds].filter(id => id !== selectedId);
      await createAndCacheReport(activeCluster.id, selectedId, relatedIds);
      setCenterNewsId(selectedId);
      setActiveClusterId(activeCluster.id);
      navigate('report');
    } catch (error) {
      // 백엔드가 이유를 구분해 준다 — 404 정치·사회 기사, 502 본문 추출 실패,
      // 503 분류 확인 실패·저장 실패.
      setErrorMsg(errorMessage(error, '리포트를 만들지 못했습니다.', '잠시 후 다시 시도해 주세요.'));
    } finally {
      setLoadingLabel(null);
    }
  };

  /** 중심 뉴스의 이웃을 그래프 API 로 받아 맵을 다시 구성한다. 실패는 호출부가 처리한다. */
  const loadNeighbours = (newsId: string, clusterId: string) =>
    fetchAndCacheNewsMap(newsId, clusterId, MAX_RELATED_NODES);

  /**
   * 연관 노드를 맵 중심으로 끌어온다.
   *
   * 중심은 먼저 바꿔서 재배치 애니메이션이 바로 돌게 하고, 그 뉴스의 이웃은
   * 뒤이어 받아 채운다. 전체 화면 오버레이를 띄우면 방금 시작한 애니메이션을
   * 가리므로 맵 위에 작은 상태 표시만 낸다.
   */
  const focusNews = async (newsId: string) => {
    const clusterId = activeCluster.id;
    setCenterNewsId(newsId);
    setIsExpandingMap(true);
    try {
      await loadNeighbours(newsId, clusterId);
      setClusterRevision((v) => v + 1);
    } catch {
      // 이웃을 못 받으면 지금 클러스터에 있는 뉴스로 계속 보여준다
    } finally {
      setIsExpandingMap(false);
    }
  };

  return (
    <main className="app-shell">
      <section className={`prototype-frame screen-${screen}`} aria-label="뉴스맵 클릭모형">
        <HeaderBar screen={screen} isDark={isDark} onToggleTheme={toggleTheme} />

        <AnimatePresence initial={false}>
          {screen === 'home' && (
            <ScreenSurface key="home" className="home-view">
              <HomeView
                query={query}
                setQuery={setQuery}
                keywords={recommendedKeywords}
                onSearch={() => openCluster(query)}
                onKeyword={openCluster}
              />
            </ScreenSurface>
          )}

          {screen === 'searchResults' && (
            <ScreenSurface key="searchResults" className="results-view">
              <SearchResultsView
                cluster={activeCluster}
                busy={loadingLabel !== null}
                onOpenKeywordNewsMap={openKeywordNewsMap}
              />
            </ScreenSurface>
          )}

          {screen === 'newsMap' && !centerNewsId && (
            <ScreenSurface key="newsMapEmpty" className="map-view">
              {/* 검색이 실패했거나 그릴 기사가 없을 때. 예전에는 정적 목 데이터를
                  대신 보여줘서 실패가 성공처럼 보였다. */}
              <EmptyState
                title={errorMsg ? '뉴스 검색 실패' : '조건에 맞는 뉴스가 없습니다'}
                hint={
                  errorMsg ??
                  '검색한 20건 중 표시할 네이버 뉴스가 없습니다. 정치·사회 및 분류를 확인하지 못한 기사는 제외됩니다.'
                }
              />
            </ScreenSurface>
          )}

          {screen === 'newsMap' && centerNewsId && (
            <ScreenSurface key="newsMap" className="map-view">
              <NewsMapView
                centerNews={centerNews}
                relatedNews={visibleNews}
                busy={loadingLabel !== null}
                expanding={isExpandingMap}
                onOpenDetail={openDetail}
                onFocusNews={focusNews}
              />
            </ScreenSurface>
          )}

          {screen === 'newsDetail' && (
            <ScreenSurface key="newsDetail" className="split-view">
              <DetailView
                centerNews={centerNews}
                detailNews={resolveNews(detailNewsId)}
                relatedNews={visibleNews}
                errorMsg={errorMsg}
                onOpenDetail={openDetail}
                onFocusNews={focusNews}
                onOpenReport={openReport}
              />
            </ScreenSurface>
          )}

          {screen === 'report' && (
            <ScreenSurface key="report" className="split-view report-view">
              <ReportView
                centerNews={centerNews}
                relatedNews={visibleNews}
                report={report}
                onOpenDetail={openDetail}
                onFocusNews={focusNews}
              />
            </ScreenSurface>
          )}
        </AnimatePresence>

        {screen !== 'home' && (
          <BottomControls
            screen={screen}
            canGoBack={history.length > 0}
            onBack={goBack}
            onSearch={() => navigate('home')}
            onReport={openReport}
            hasNews={Boolean(screen === 'newsDetail' ? detailNewsId : centerNewsId)}
          />
        )}

        <Toast message={errorMsg} onDismiss={dismissError} />

        <AnimatePresence>
          {loadingLabel && <LoadingOverlay label={loadingLabel} />}
        </AnimatePresence>
      </section>
    </main>
  );
}

// ── 화면 래퍼 ────────────────────────────────────────────────────────
/**
 * 5개 화면이 모두 position:absolute로 겹쳐 있어 cross-fade 전환에 유리하다.
 * AnimatePresence를 sync 모드로 두어 layoutId 공유 요소(검색창)가 이어지게 한다.
 */
function ScreenSurface({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <motion.section
      className={`view-surface ${className}`}
      variants={screenVariants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      {children}
    </motion.section>
  );
}

// ── HeaderBar ────────────────────────────────────────────────────────
function HeaderBar({
  screen,
  isDark,
  onToggleTheme,
}: {
  screen: Screen;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <header className="header-bar">
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={screen}
          className="view-chip"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={easeOut}
        >
          {viewNames[screen]}
        </motion.div>
      </AnimatePresence>
    </header>
  );
}

// ── HomeView ─────────────────────────────────────────────────────────
function HomeView({
  query,
  setQuery,
  keywords,
  onSearch,
  onKeyword,
}: {
  query: string;
  setQuery: (q: string) => void;
  keywords: string[];
  onSearch: () => void;
  onKeyword: (kw: string) => void;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <>
      <motion.h1 className="logo-mark" variants={riseVariants}>
        {PROJECT_TITLE}
      </motion.h1>

      {/* layoutId로 검색 결과 화면의 하단 검색 스트립과 이어진다 */}
      <motion.form
        layoutId="search-surface"
        className="search-form"
        onSubmit={submit}
        transition={springSoft}
      >
        <Search aria-hidden="true" size={20} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="뉴스 키워드 검색"
          aria-label="뉴스 키워드 검색"
        />
        <motion.button type="submit" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
          검색
        </motion.button>
      </motion.form>

      <motion.div
        className="keyword-row"
        variants={staggerContainer(0.045, 0.18)}
        initial="enter"
        animate="center"
        aria-label="추천 키워드"
      >
        {keywords.map((kw) => (
          <motion.button
            key={kw}
            type="button"
            variants={riseVariants}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            onClick={() => onKeyword(kw)}
          >
            {kw}
          </motion.button>
        ))}
      </motion.div>

      <motion.div className="home-footer" variants={fadeVariants}>
        <span>추천 이슈</span>
        <strong>중동 전황 · AI 서버 · 환율</strong>
      </motion.div>
    </>
  );
}

// ── SearchResultsView ────────────────────────────────────────────────
function SearchResultsView({
  cluster,
  busy,
  onOpenKeywordNewsMap,
}: {
  cluster: IssueCluster;
  busy: boolean;
  onOpenKeywordNewsMap: (kw: string) => void;
}) {
  const keywords = getSearchKeywordNodes(cluster);

  return (
    <>
      {busy ? (
        <div className="orbit-field">
          <MapSkeleton />
        </div>
      ) : keywords.length === 0 ? (
        <div className="orbit-field">
          <EmptyState
            title="연관 키워드를 찾지 못했습니다"
            hint="다른 검색어로 다시 시도해 보세요."
          />
        </div>
      ) : (
        <KeywordMap keywords={keywords} onSelect={onOpenKeywordNewsMap} />
      )}

      <motion.div layoutId="search-surface" className="result-search-strip" transition={springSoft}>
        <Search size={16} aria-hidden="true" />
        <span>{cluster.query}</span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenKeywordNewsMap(cluster.query)}
        >
          열기
        </motion.button>
      </motion.div>
    </>
  );
}

// ── NewsMapView ──────────────────────────────────────────────────────
function NewsMapView({
  centerNews,
  relatedNews,
  busy,
  expanding,
  onOpenDetail,
  onFocusNews,
}: {
  centerNews: NewsCard;
  relatedNews: NewsCard[];
  busy: boolean;
  expanding: boolean;
  onOpenDetail: (newsId: string) => void;
  onFocusNews: (newsId: string) => void;
}) {
  return (
    <>
      {busy ? (
        <div className="news-map-field">
          <MapSkeleton />
        </div>
      ) : (
        <NewsMapCanvas
          centerNews={centerNews}
          relatedNews={relatedNews}
          onOpenDetail={onOpenDetail}
          onFocusNews={onFocusNews}
        />
      )}

      {/* 중심을 바꾼 뒤 이웃을 받아오는 동안 — 화면을 막지 않는 표시 */}
      <AnimatePresence>
        {expanding && (
          <motion.div
            className="map-status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={easeOut}
            role="status"
          >
            연관 뉴스를 잇는 중…
          </motion.div>
        )}
      </AnimatePresence>

      <PremiumPreview />
    </>
  );
}

// ── DetailView ───────────────────────────────────────────────────────
function DetailView({
  centerNews,
  detailNews,
  relatedNews,
  errorMsg,
  onOpenDetail,
  onFocusNews,
  onOpenReport,
}: {
  centerNews: NewsCard;
  detailNews: NewsCard;
  relatedNews: NewsCard[];
  errorMsg: string | null;
  onOpenDetail: (newsId: string) => void;
  onFocusNews: (newsId: string) => void;
  onOpenReport: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.scrollTo(0, 0);
    panel.current?.parentElement?.scrollTo(0, 0);
  }, [detailNews.id]);

  return (
    <>
      <aside className="mini-map">
        <NewsMapCanvas
          centerNews={centerNews}
          relatedNews={relatedNews}
          compact
          onOpenDetail={onOpenDetail}
          onFocusNews={onFocusNews}
        />
      </aside>

      <motion.article
        className="detail-panel"
        key={detailNews.id}
        ref={panel}
        tabIndex={0}
        aria-label="기사 설명 영역"
        variants={staggerContainer(0.05)}
        initial="enter"
        animate="center"
      >
        <motion.div className={`story-hero tone-${detailNews.thumbnailTone}`} variants={fadeVariants}>
          <SmartImage src={detailNews.imageUrl} alt="" eager />
          <div className="story-hero-overlay" aria-hidden="true" />
          <Newspaper size={40} aria-hidden="true" />
        </motion.div>

        <div className="panel-content">
          <motion.div className="source-line" variants={riseVariants}>
            <span>{detailNews.source}</span>
            <time>{detailNews.publishedAt}</time>
          </motion.div>

          <motion.h2 variants={riseVariants}>{detailNews.title}</motion.h2>
          <motion.h3 variants={riseVariants}>기사 설명</motion.h3>
          <motion.p className="article-body" variants={riseVariants}>
            {detailNews.summary || '제공된 기사 설명이 없습니다.'}
          </motion.p>
          {errorMsg && (
            <motion.p role="alert" variants={riseVariants}>
              {errorMsg}
            </motion.p>
          )}

          {detailNews.sourceUrl ? (
            <motion.div className="source-link-card" variants={riseVariants}>
              <span>원문 링크</span>
              <a href={detailNews.sourceUrl} target="_blank" rel="noreferrer">
                {detailNews.sourceUrl}
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </motion.div>
          ) : null}

          <motion.div className="tag-list" variants={riseVariants}>
            {detailNews.keywords.map((kw) => (
              <span key={kw}>{kw}</span>
            ))}
          </motion.div>

          <motion.button
            type="button"
            className="primary-action"
            variants={riseVariants}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            onClick={onOpenReport}
          >
            <FileText size={18} aria-hidden="true" />
            리포트 보기
          </motion.button>
        </div>
      </motion.article>
    </>
  );
}

// ── ReportView ───────────────────────────────────────────────────────
function ReportView({
  centerNews,
  relatedNews,
  report,
  onOpenDetail,
  onFocusNews,
}: {
  centerNews: NewsCard;
  relatedNews: NewsCard[];
  report: Report;
  onOpenDetail: (newsId: string) => void;
  onFocusNews: (newsId: string) => void;
}) {
  return (
    <>
      <aside className="mini-map report-map">
        <NewsMapCanvas
          centerNews={centerNews}
          relatedNews={relatedNews}
          compact
          onOpenDetail={onOpenDetail}
          onFocusNews={onFocusNews}
        />
      </aside>

      <motion.article
        className="report-panel"
        key={report.id}
        variants={staggerContainer(0.06)}
        initial="enter"
        animate="center"
      >
        <div className="panel-content">
          <motion.div className="source-line" variants={riseVariants}>
            <span>AI Report</span>
            <time>실시간 뉴스 기반 분석</time>
          </motion.div>

          <motion.h2 variants={riseVariants}>{report.title}</motion.h2>

          <motion.section className="report-block" variants={riseVariants}>
            <h3>사건 요약</h3>
            <p>{report.eventSummary}</p>
          </motion.section>

          <motion.section className="report-block" variants={riseVariants}>
            <h3>시장 영향</h3>
            <p>{report.marketImpact}</p>
          </motion.section>

          {report.stockImpacts.length > 0 && (
            <motion.section
              className="impact-grid"
              variants={staggerContainer(0.07)}
              aria-label="종목 영향"
            >
              {report.stockImpacts.map((stock, i) => (
                <motion.article
                  key={`${stock.name}-${i}`}
                  className={`impact-card ${stock.direction}`}
                  variants={riseVariants}
                  whileHover={{ y: -3 }}
                  transition={springSnappy}
                >
                  <div className="impact-head">
                    <strong>{stock.name}</strong>
                    {/* 색만으로 방향을 나타내면 색각 이상 사용자가 구분할 수 없다 */}
                    {stock.actionLabel && <span className="impact-action">{stock.actionLabel}</span>}
                  </div>
                  {stock.symbol && <span className="impact-ticker">{stock.symbol}</span>}
                  {stock.impact && <p>{stock.impact}</p>}
                </motion.article>
              ))}
            </motion.section>
          )}

          <motion.section className="chart-block" variants={riseVariants}>
            <MiniChart />
            <div className="strategy-box">
              <LineChart size={22} aria-hidden="true" />
              <div>
                <strong>{report.strategySummary.stance}</strong>
                <p>{report.strategySummary.rationale}</p>
              </div>
            </div>
          </motion.section>

          {/* 종목 카드가 이미 같은 종목을 보여주므로 카드가 없을 때만 낸다 */}
          {report.stockImpacts.length === 0 && report.strategySummary.watchlist.length > 0 && (
            <motion.section className="report-block" variants={riseVariants}>
              <h3>관심 종목</h3>
              <div className="tag-list">
                {report.strategySummary.watchlist.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </motion.section>
          )}

          <motion.section className="report-block" variants={riseVariants}>
            <h3>리스크 요인</h3>
            <div className="tag-list">
              {report.riskFactors.map((risk) => (
                <span key={risk}>{risk}</span>
              ))}
            </div>
            {report.strategySummary.riskWarning && (
              <p className="risk-warning">{report.strategySummary.riskWarning}</p>
            )}
          </motion.section>

          <motion.div variants={riseVariants}>
            <PremiumPreview dense />
          </motion.div>
        </div>
      </motion.article>
    </>
  );
}

// ── PremiumPreview ───────────────────────────────────────────────────
function PremiumPreview({ dense = false }: { dense?: boolean }) {
  return (
    <motion.aside
      className={`premium-preview${dense ? ' dense' : ''}`}
      initial={{ opacity: 0, x: dense ? 0 : 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springSoft, delay: 0.3 }}
      aria-label="유료 기능 프리뷰"
    >
      <div className="premium-header">
        <Lock size={14} aria-hidden="true" />
        <strong>유료 프리뷰</strong>
      </div>
      <button type="button" disabled>뉴스 선택/제외</button>
      <button type="button" disabled>연관도 상세</button>
      <button type="button" disabled>심화 리포트</button>
    </motion.aside>
  );
}

// ── BottomControls ───────────────────────────────────────────────────
function BottomControls({
  screen,
  canGoBack,
  onBack,
  onSearch,
  onReport,
  hasNews,
}: {
  screen: Screen;
  canGoBack: boolean;
  onBack: () => void;
  onSearch: () => void;
  onReport: () => void;
  hasNews: boolean;
}) {
  const reportDisabled = screen === 'home' || screen === 'searchResults';

  return (
    <motion.nav
      className="bottom-controls"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: 0.12 }}
      aria-label="화면 컨트롤"
    >
      <NavButton onClick={onBack} disabled={!canGoBack} label="뒤로가기">
        <ArrowLeft aria-hidden="true" />
      </NavButton>
      <NavButton onClick={onReport} disabled={!hasNews || reportDisabled} label="리포트">
        <FileText aria-hidden="true" />
      </NavButton>
      <NavButton onClick={onSearch} label="검색">
        <Search aria-hidden="true" />
      </NavButton>
    </motion.nav>
  );
}

function NavButton({
  onClick,
  disabled = false,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileHover={disabled ? undefined : { scale: 1.08 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={springSnappy}
    >
      {children}
    </motion.button>
  );
}

// ── MiniChart ────────────────────────────────────────────────────────
/**
 * 목업 차트. 백엔드에 시세 데이터가 없어 값 자체는 고정이며, 실제 수치가 아니다.
 * (docs 6.6 미구현 항목 — 실시간 시세 연동 없음)
 */
const CHART_BARS = [34, 62, 48, 74, 56, 82, 68];

function MiniChart() {
  const motionSafe = useMotionSafe();

  return (
    <div className="mini-chart" aria-label="전략 성과 목업 차트" role="img">
      {CHART_BARS.map((h, i) => (
        <motion.span
          key={`${h}-${i}`}
          initial={motionSafe ? { height: 0 } : false}
          animate={{ height: `${h}%` }}
          transition={{ ...springSoft, delay: 0.15 + i * 0.05 }}
        />
      ))}
    </div>
  );
}

// ── 순수 유틸 ────────────────────────────────────────────────────────
function getSearchKeywordNodes(cluster: IssueCluster): string[] {
  const seen = new Set<string>();
  const nodes: string[] = [];

  for (const keyword of cluster.recommendedKeywords) {
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    nodes.push(keyword);
  }

  return nodes.slice(0, MAX_KEYWORD_NODES);
}

/**
 * 맵에 그릴 연관 뉴스. 클러스터에 실제로 들어 있는 뉴스만 돌려준다.
 *
 * 이전 구현은 개수가 모자라면 staticNewsCards 로 채웠다. 그래서 API 가
 * 1건만 반환하면 AI 기사 옆에 전혀 무관한 원유 기사가 "연관 뉴스"로 붙었다.
 * 부족하면 부족한 대로 그리는 편이 맞다. resolveNews 는 모르는 id 에
 * staticNewsCards[0] 을 돌려주므로 여기서는 findKnownNews 를 쓴다.
 */
function getVisibleNews(cluster: IssueCluster, centerNewsId: string): NewsCard[] {
  return [cluster.mainNewsId, ...cluster.relatedNewsIds]
    .filter((id) => id && id !== centerNewsId)
    .map(findKnownNews)
    .filter((news): news is NewsCard => news !== undefined)
    .slice(0, MAX_RELATED_NODES);
}

export default App;
