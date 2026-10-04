import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, FileText, Search } from 'lucide-react';
import {
  DEFAULT_HOME_KEYWORDS,
  ServiceError,
  fetchKeywordMap,
  fetchNewsMap,
  fetchRecommendedKeywords,
  type KeywordMapData,
  type NewsMapData,
} from './data/newsMapService';
import { useTheme } from './design/useTheme';
import { MAX_KEYWORD_NODES } from './layout/mapLayout';
import {
  easeOut,
  fadeVariants,
  riseVariants,
  screenVariants,
  springSnappy,
  springSoft,
  staggerContainer,
} from './motion/presets';
import { KeywordMap } from './components/KeywordMap';
import {
  NEWS_MAP_DEFAULT_STATUS,
  NewsMapExplorer,
  NewsMapStatusPill,
  type NewsMapChrome,
  type NewsMapExplorerHandle,
} from './components/NewsMapExplorer';
import { EmptyState, LoadingOverlay, MapSkeleton, ThemeToggle, Toast } from './components/ui';

/**
 * 뉴스맵 프로토타입(design/newsmap-prototype, 2026-09-27) 적용 화면.
 * 01 검색창 → 02 키워드 맵 → 03 뉴스맵(상세·레포트 포함). 데이터는 newsMapService.ts —
 * 기본 실제 API, VITE_NEWS_MAP_SOURCE=mock 이면 브라우저 mock 서비스.
 */
type Screen = 'home' | 'searchResults' | 'newsMap';

const PROJECT_TITLE = '실시간 뉴스 기반 멀티 에이전트 투자 판단 지원 시스템';

const viewNames: Record<Screen, string> = {
  home: '검색창',
  searchResults: '키워드 맵',
  newsMap: '뉴스맵',
};

const INITIAL_CHROME: NewsMapChrome = { chip: '뉴스맵', status: NEWS_MAP_DEFAULT_STATUS, panel: 'none' };

function App() {
  const { isDark, toggle: toggleTheme } = useTheme();

  const [screen, setScreen] = useState<Screen>('home');
  const [history, setHistory] = useState<Screen[]>([]);
  const [query, setQuery] = useState('');
  const [keywordMap, setKeywordMap] = useState<KeywordMapData>({ query: '', keywords: [] });
  const [newsMap, setNewsMap] = useState<NewsMapData | null>(null);
  /** 같은 키워드를 다시 열어도 뉴스맵을 처음 상태로 새로 그린다. */
  const [newsMapKey, setNewsMapKey] = useState(0);
  const [mapChrome, setMapChrome] = useState<NewsMapChrome>(INITIAL_CHROME);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recommendedKeywords, setRecommendedKeywords] = useState(DEFAULT_HOME_KEYWORDS);
  const request = useRef(0);
  const explorer = useRef<NewsMapExplorerHandle>(null);

  useEffect(() => {
    let isMounted = true;
    fetchRecommendedKeywords(8)
      .then((keywords) => {
        if (isMounted && keywords.length > 0) setRecommendedKeywords(keywords);
      })
      .catch(() => {
        if (isMounted) setErrorMsg('추천 키워드를 불러오지 못했습니다 — 기본 키워드로 표시합니다.');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const navigate = (nextScreen: Screen) => {
    setHistory((prev) => [...prev, screen]);
    setScreen(nextScreen);
  };

  /** 업데이터 안에서 setScreen 을 부르면 StrictMode 에서 두 번 실행되므로 상태 갱신을 분리한다. */
  const goBack = () => {
    const previous = history[history.length - 1] ?? 'home';
    setHistory((prev) => prev.slice(0, -1));
    setScreen(previous);
  };

  const dismissError = useCallback(() => setErrorMsg(null), []);

  /** 검색어 → 키워드맵 */
  const openCluster = async (term: string) => {
    const current = ++request.current;
    setLoadingLabel('연관 키워드를 찾는 중…');
    setErrorMsg(null);
    try {
      const next = await fetchKeywordMap(term);
      if (current !== request.current) return;
      setQuery(next.query);
      setKeywordMap(next);
      navigate('searchResults');
    } catch (error) {
      if (current === request.current) {
        setErrorMsg(error instanceof ServiceError && error.status < 500 && error.status !== 0
          ? error.message : '연관 키워드를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      if (current === request.current) setLoadingLabel(null);
    }
  };

  /** 키워드 → 뉴스맵 */
  const openKeywordNewsMap = async (term: string) => {
    const current = ++request.current;
    setLoadingLabel('관련 뉴스를 모으는 중…');
    setErrorMsg(null);
    try {
      const next = await fetchNewsMap(term);
      if (current !== request.current) return;
      setNewsMap(next);
      setNewsMapKey((k) => k + 1);
      setMapChrome(INITIAL_CHROME);
      navigate('newsMap');
    } catch (error) {
      if (current === request.current) {
        // 검색 결과 없음(404)은 그대로 알리고, 서버·네트워크 오류는 재시도를 안내한다.
        setErrorMsg(error instanceof ServiceError && error.status === 404
          ? error.message : '뉴스 검색에 실패했습니다. 잠시 후 다시 검색해 주세요.');
      }
    } finally {
      if (current === request.current) setLoadingLabel(null);
    }
  };

  const onNewsMap = screen === 'newsMap' && newsMap !== null;
  const panel = onNewsMap ? mapChrome.panel : 'none';

  return (
    <main className="app-shell">
      <section className={`prototype-frame screen-${screen}`} data-panel={panel} aria-label="뉴스맵 클릭모형">
        <HeaderBar
          chip={onNewsMap ? mapChrome.chip : viewNames[screen]}
          status={onNewsMap ? mapChrome.status : null}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

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
                query={keywordMap.query}
                keywords={keywordMap.keywords}
                busy={loadingLabel !== null}
                onOpenKeywordNewsMap={openKeywordNewsMap}
              />
            </ScreenSurface>
          )}

          {onNewsMap && (
            <ScreenSurface key={`newsMap-${newsMapKey}`} className="explorer-view">
              <NewsMapExplorer
                ref={explorer}
                map={newsMap}
                onChrome={setMapChrome}
                onOpenKeyword={openCluster}
              />
            </ScreenSurface>
          )}
        </AnimatePresence>

        {screen !== 'home' && (
          <BottomControls
            canGoBack={history.length > 0}
            onBack={goBack}
            onSearch={() => navigate('home')}
            onReport={() => explorer.current?.openReport()}
            reportEnabled={onNewsMap}
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
/** 화면이 모두 position:absolute로 겹쳐 있어 cross-fade 전환에 유리하다. */
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
  chip,
  status,
  isDark,
  onToggleTheme,
}: {
  chip: string;
  /** 뉴스맵 화면의 상태 문구. 다른 화면에서는 null */
  status: string | null;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  return (
    <header className="header-bar">
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      {status !== null && <NewsMapStatusPill text={status} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={chip}
          className="view-chip"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={easeOut}
        >
          {chip}
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
  query,
  keywords,
  busy,
  onOpenKeywordNewsMap,
}: {
  query: string;
  keywords: string[];
  busy: boolean;
  onOpenKeywordNewsMap: (kw: string) => void;
}) {
  const nodes = keywords.slice(0, MAX_KEYWORD_NODES);

  return (
    <>
      {busy ? (
        <div className="orbit-field">
          <MapSkeleton />
        </div>
      ) : nodes.length === 0 ? (
        <div className="orbit-field">
          <EmptyState title="연관 키워드를 찾지 못했습니다" hint="다른 검색어로 다시 시도해 보세요." />
        </div>
      ) : (
        <KeywordMap keywords={nodes} onSelect={onOpenKeywordNewsMap} />
      )}

      <motion.div layoutId="search-surface" className="result-search-strip" transition={springSoft}>
        <Search size={16} aria-hidden="true" />
        <span>{query}</span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onOpenKeywordNewsMap(query)}
        >
          열기
        </motion.button>
      </motion.div>
    </>
  );
}

// ── BottomControls ───────────────────────────────────────────────────
function BottomControls({
  canGoBack,
  onBack,
  onSearch,
  onReport,
  reportEnabled,
}: {
  canGoBack: boolean;
  onBack: () => void;
  onSearch: () => void;
  onReport: () => void;
  reportEnabled: boolean;
}) {
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
      <NavButton onClick={onReport} disabled={!reportEnabled} label="리포트">
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

export default App;
