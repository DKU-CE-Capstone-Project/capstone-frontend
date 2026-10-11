/**
 * 뉴스맵 프로토타입(design/newsmap-prototype, 2026-09-27)용 mock 서비스.
 *
 * 이 브랜치는 검색·뉴스·리포트를 백엔드 대신 이 모듈에서 받는다. 프로토타입이 요구하는
 * 다단계 펼치기·재검색·여러 기사 근거 리포트·생성 단계 표시는 현재 백엔드 계약에 없다
 * (프로토타입 README의 "현재 백엔드로 동작 가능한지" 표). 실제 API 형태를 흉내 내도록
 * 모든 호출은 비동기이며 짧은 지연을 둔다.
 *
 * - 중동 전황 주제의 중앙 뉴스와 1단계 연관 뉴스 4건은 mockData.ts의 목업 기사다.
 * - 하위 뉴스·재검색 결과·나머지 주제는 샘플이며 출처를 `[샘플 기사]`로 표시한다.
 * - 프로토타입처럼 썸네일 대신 톤 블록을 쓰므로 외부 이미지를 불러오지 않는다(imageUrl '').
 */

import { getNews, getReport, type NewsCard, type Report } from './mockData';

type Tone = NewsCard['thumbnailTone'];

type SetItem = { news: NewsCard; branch: number };

type Topic = {
  id: string;
  /** 키워드맵에 놓을 연관 키워드. 검색어 다음 순서대로 쓴다. */
  keywords: string[];
  /** 이 주제로 판단할 검색어. 부분 일치를 허용한다. */
  match: string[];
  root: NewsCard;
  /** 중앙 카드의 연관 뉴스. 재검색할 때마다 두 묶음을 번갈아 낸다. */
  rootSets: [SetItem[], SetItem[]];
  /** 가지별 하위 뉴스 제목 풀 */
  pools: string[][];
  branchKeywords: string[];
  branchTones: Tone[];
  report: Report;
  /** 리포트 하단 안내 문구에 쓰는 목업 리포트 이름 */
  reportLabel: string;
};

export type MockKeywordMap = { query: string; keywords: string[] };

export type MockNewsMap = {
  keyword: string;
  topicId: string;
  root: NewsCard;
  related: NewsCard[];
  /** 근거가 여러 건일 때의 리포트 제목 */
  reportTitle: string;
  reportLabel: string;
};

export type ReportPhase = 0 | 1 | 2 | 3;

/** 홈 화면 추천 키워드 (프로토타입 01 검색창) */
export const MOCK_HOME_KEYWORDS = ['중동 전황', '원유', '해운', '방산', '환율', '정유', '에너지 ETF', '운임'];

const DEFAULT_QUERY = '중동 전황';
const SAMPLE_SOURCE = '[샘플 기사]';

// 실제 API 호출처럼 보이도록 두는 지연(ms). 리포트 단계 간격은 프로토타입 값이다.
const LATENCY = { keywords: 260, search: 420, expand: 320, research: 800, reportStep: 650 };
let latencyScale = 1;

/** 테스트에서 지연을 없앨 때 쓴다. */
export function setMockLatencyScale(scale: number) {
  latencyScale = scale;
}

// ── 주제 데이터 ─────────────────────────────────────────────────────

function card(news: NewsCard): NewsCard {
  return { ...news, imageUrl: '' };
}

function sample(id: string, title: string, tone: Tone, keyword: string): NewsCard {
  return {
    id,
    title,
    source: SAMPLE_SOURCE,
    publishedAt: '',
    summary: '',
    mockOriginalBody: '',
    thumbnailTone: tone,
    imageUrl: '',
    keywords: [keyword],
    relatedStockSymbols: [],
    sentiment: 'neutral',
  };
}

function sampleSet(prefix: string, titles: string[], tones: Tone[], keywords: string[]): SetItem[] {
  return titles.map((title, branch) => ({
    news: sample(`${prefix}-${branch}`, title, tones[branch], keywords[branch]),
    branch,
  }));
}

const MIDDLE_EAST: Topic = (() => {
  const branchKeywords = ['정유', '해운', '환율', '방산'];
  const branchTones: Tone[] = ['oil', 'shipping', 'currency', 'defense'];
  return {
    id: 'middle-east',
    keywords: ['중동 전황', '원유', '해운', '방산', '환율', '정유', '에너지 ETF', '운임', '물류비', '해협 리스크', '수입 물가'],
    match: ['중동', '원유', '유가', '해운', '방산', '환율', '정유', '에너지', '운임', '물류비', '해협', '호르무즈', '수입 물가'],
    root: card(getNews('oil-1')),
    rootSets: [
      [
        { news: card(getNews('oil-2')), branch: 0 },
        { news: card(getNews('oil-3')), branch: 1 },
        { news: card(getNews('currency-1')), branch: 2 },
        { news: card(getNews('oil-4')), branch: 3 },
      ],
      sampleSet(
        'middle-east-alt',
        ['국제유가 변동성 확대, 에너지주 등락 반복', '호르무즈 해협 통항 차질 우려 지속', '항공·화학 업종 원가 부담 부각', '긴장 완화 신호에 방산주 차익 실현'],
        branchTones,
        branchKeywords,
      ),
    ],
    pools: [
      ['정제마진 반등, 정유사 실적 기대', '에너지 ETF 자금 유입 확대', '재고 지표 발표 앞두고 관망세', '정유주 차익 실현 매물 출회', '휘발유 가격 상승 압력', '원유 재고 감소 전망', '산유국 증산 논의 재부상', '정유 설비 가동률 상승', '석유화학 스프레드 개선', '연료비 부담에 소비 둔화 우려', '에너지 기업 배당 확대 기대', '유가 헤지 수요 증가'],
      ['우회 항로 확대로 운송 기간 증가', '해상 보험료 인상 움직임', '컨테이너 운임 단기 급등', '선사들 운임 할증료 부과', '수출 기업 물류비 부담 가중', '항만 적체 우려 확산', '벌크선 운임 동반 상승', '항공 화물 수요 일시 증가', '조선사 신규 수주 문의 증가', '물류 대란 재현 가능성 점검', '해운주 변동성 확대', '공급망 재편 논의 가속'],
      ['원·달러 환율 상승, 수입 기업 부담', '항공주 환율 민감도 부각', '안전자산 선호 강화', '외국인 순매도 확대', '원자재 수입 단가 상승', '환헤지 수요 증가', '수출주 환율 효과 기대', '금 가격 강세 지속', '채권 금리 방향성 혼조', '소비자물가 상방 압력', '통화당국 시장 개입 경계', '신흥국 통화 약세 확산'],
      ['방공 체계 수출 협상 기대', '방산 테마주 거래량 급증', '수주 공시 확인 필요성 부각', '방산주 단기 과열 경고', '국방 예산 증액 논의', '감시 장비 수요 증가', '드론 방어 기술 관심 확대', '방산 부품사 동반 강세', '해외 방산 전시회 일정 주목', '지정학 리스크 프리미엄 축소', '방산 수출 금융 지원 논의', '장기 계약 가시성 점검'],
    ],
    branchKeywords,
    branchTones,
    report: getReport('report-oil'),
    reportLabel: '중동 항로 리포트',
  };
})();

const AI_INFRA: Topic = (() => {
  const branchKeywords = ['전력망', '반도체 장비', '환율', '클라우드'];
  const branchTones: Tone[] = ['ai', 'chip', 'currency', 'chip'];
  const cloud: NewsCard = {
    id: 'ai-4',
    title: 'GPU 공급 확대에 클라우드 3사 설비투자 상향',
    source: 'Cloud Insight',
    publishedAt: '2026-04-29 14:20',
    summary: '클라우드 3사가 GPU 공급 확대에 맞춰 연간 설비투자 계획을 올리며 데이터센터 증설 경쟁이 이어졌다.',
    mockOriginalBody: '',
    thumbnailTone: 'chip',
    imageUrl: '',
    keywords: ['클라우드', 'GPU', '설비투자', '데이터센터'],
    relatedStockSymbols: [],
    sentiment: 'positive',
  };
  return {
    id: 'ai-infra',
    keywords: ['AI 서버', 'HBM', '전력망', '반도체 장비', '데이터센터', '냉각', 'GPU', '패키징', '변압기', '클라우드', '환율'],
    match: ['ai', '인공지능', 'hbm', '반도체', '메모리', '전력망', '데이터센터', '냉각', 'gpu', '패키징', '변압기', '클라우드', '엔비디아'],
    root: card(getNews('ai-1')),
    rootSets: [
      [
        { news: card(getNews('ai-2')), branch: 0 },
        { news: card(getNews('ai-3')), branch: 1 },
        // 같은 기사라도 주제마다 ID를 달리해야 등록부에서 가지가 섞이지 않는다.
        { news: { ...card(getNews('currency-1')), id: 'ai-currency-1' }, branch: 2 },
        { news: cloud, branch: 3 },
      ],
      sampleSet(
        'ai-infra-alt',
        ['전력 설비 수주 기대에 관련주 강세', 'HBM 증설 일정 앞당겨질 가능성', '환율 상승에 수입 장비 비용 부담', 'AI 서비스 수익화 속도 논란'],
        branchTones,
        branchKeywords,
      ),
    ],
    pools: [
      ['변압기 수주 잔고 사상 최대', '데이터센터 전력 계약 경쟁 심화', '송배전 설비 투자 확대 발표', '전력 기자재 수출 증가세', '전력 요금 인상 논의 재점화', '냉각 설비 수요 동반 증가', '소형 원전 협력 논의 부상', '전력망 인허가 지연 우려', '전선 업체 증설 계획 공개', 'ESS 수요 확대 전망', '전력 인프라 ETF 자금 유입', '데이터센터 입지 경쟁 가열'],
      ['HBM 패키징 장비 발주 확대', '전공정 장비 리드타임 추가 단축', '후공정 테스트 장비 수요 증가', '장비 국산화 비중 확대 기대', '노광 장비 인도 일정 점검', '반도체 소재 가격 안정세', '장비사 수주 잔고 증가', '증착 장비 수주 경쟁 심화', '장비 수출 규제 영향 점검', '첨단 패키징 투자 가속', '클린룸 증설 수요 확대', '소부장 기업 실적 개선 기대'],
      ['원·달러 환율 상승, 수입 장비 부담', '반도체 수출 환율 효과 기대', '외국인 반도체주 순매수 전환', '달러 강세에 원자재 단가 상승', '환헤지 수요 증가', '수출 대금 환전 시점 고민', '해외 설비투자 비용 증가', '금리 동결 전망에 환율 안정', '엔화 약세로 경쟁 구도 변화', '위안화 변동성 확대', '환율 민감 업종 실적 점검', '통화당국 시장 개입 경계'],
      ['클라우드 3사 설비투자 상향', 'AI 서비스 가격 인하 경쟁', '국내 클라우드 사업자 GPU 확보', '생성형 AI 구독 매출 증가', '데이터센터 리츠 관심 확대', 'GPU 임대 시장 급성장', '클라우드 보안 투자 확대', '공공 클라우드 전환 사업 확대', 'AI 반도체 자체 개발 가속', '엣지 컴퓨팅 수요 부상', '서버 랙 공급 부족 지속', '클라우드 비용 최적화 수요 증가'],
    ],
    branchKeywords,
    branchTones,
    report: getReport('report-ai'),
    reportLabel: 'AI 서버 리포트',
  };
})();

/** 준비된 주제에 없는 검색어는 검색어를 넣은 샘플 주제를 만든다. */
function genericTopic(q: string): Topic {
  const id = `sample-${slug(q)}`;
  const branchKeywords = ['정책', '실적', '환율', '공급망'];
  const branchTones: Tone[] = ['chip', 'ai', 'currency', 'shipping'];
  return {
    id,
    keywords: [`${q} 관련주`, `${q} 정책`, `${q} 실적`, '환율', '금리', `${q} 수출`, `${q} 공급망`, '외국인 수급'],
    match: [q],
    root: {
      ...sample(`${id}-root`, `${q} 이슈 부각, 관련 업종 변동성 확대`, 'chip', q),
      summary: `${q} 관련 소식이 이어지며 정책·실적·환율·공급망 측면의 영향이 함께 거론됐다.`,
      keywords: [q, '정책', '실적', '공급망'],
    },
    rootSets: [
      sampleSet(
        `${id}-set0`,
        [`${q} 정책 지원 기대감 확대`, `${q} 관련 기업 실적 전망 상향`, `환율 변동에 ${q} 관련주 등락`, `${q} 공급망 재편 논의 가속`],
        branchTones,
        branchKeywords,
      ),
      sampleSet(
        `${id}-set1`,
        [`${q} 지원책 발표 앞두고 관망세`, `${q} 업종 실적 눈높이 조정`, `달러 강세 속 ${q} 수출주 주목`, `${q} 부품 조달 차질 우려 제기`],
        branchTones,
        branchKeywords,
      ),
    ],
    pools: [
      [`${q} 지원 법안 국회 논의`, `${q} 관련 규제 완화 기대`, `정부 ${q} 육성 예산 확대`, `${q} 세제 혜택 연장 검토`, `${q} 표준화 논의 본격화`, `지자체 ${q} 클러스터 조성`, `${q} 관련 공공 발주 증가`, `${q} 인허가 절차 간소화`, `${q} 해외 협력 MOU 체결`, `${q} 규제 리스크 점검`, `${q} 정책 수혜 업종 분석`, `${q} 지원 사업 공모 시작`],
      [`${q} 관련 기업 분기 실적 상회`, `${q} 매출 비중 확대 기업 주목`, `${q} 수주 공시 잇따라`, `${q} 원가 부담 완화 기대`, `${q} 관련주 목표가 상향`, `${q} 신규 고객 확보 소식`, `${q} 마진 개선 여부 점검`, `${q} 설비 증설 계획 발표`, `${q} 재고 조정 마무리 신호`, `${q} 관련 기업 배당 확대`, `${q} 실적 시즌 변동성 주의`, `${q} 장기 성장성 재평가`],
      [`환율 상승에 ${q} 수출 기업 수혜 기대`, `달러 강세로 ${q} 원가 부담`, `외국인 ${q} 관련주 순매수`, `${q} 수입 단가 변동성 확대`, `환헤지 비율 높인 ${q} 기업`, `금리 경로가 ${q} 투자심리 좌우`, `${q} 해외 매출 환산 효과`, `원화 약세 속 ${q} 업종 차별화`, `${q} 관련 ETF 환노출 점검`, `글로벌 유동성 변화와 ${q}`, `${q} 수출 지표 발표 앞두고 관망`, `${q} 업종 외국인 지분율 상승`],
      [`${q} 공급망 다변화 가속`, `${q} 핵심 부품 조달 차질 우려`, `${q} 현지 생산 확대 검토`, `${q} 물류비 상승 부담`, `${q} 원자재 확보 경쟁`, `${q} 협력사 동반 성장 기대`, `${q} 재고 확보 움직임`, `${q} 공급 과잉 우려 제기`, `${q} 생산 거점 이전 논의`, `${q} 납기 지연 리스크 점검`, `${q} 수직 계열화 전략 부상`, `${q} 공급망 투명성 요구 확대`],
    ],
    branchKeywords,
    branchTones,
    report: {
      id: `${id}-report`,
      clusterId: id,
      title: `${q} 이슈와 관련 업종 영향 리포트`,
      eventSummary: `${q} 관련 소식이 정책 기대와 실적 전망을 함께 자극하며 관련 업종의 단기 수급이 움직였다.`,
      marketImpact: '정책 수혜 기대는 단기 모멘텀이지만 환율과 공급망 비용이 실적 개선 폭을 제한할 수 있다.',
      stockImpacts: [
        { symbol: '', name: `${q} 대표 기업`, impact: '정책·수요 기대가 먼저 주가에 반영될 수 있다.', direction: 'up' },
        { symbol: '', name: `${q} 부품·소재 기업`, impact: '수주 증가와 원가 부담이 함께 작용한다.', direction: 'mixed' },
        { symbol: '', name: '수출 비중 높은 기업', impact: '환율 방향에 따라 실적 민감도가 커진다.', direction: 'mixed' },
      ],
      riskFactors: ['정책 일정 지연', '환율 급변', '공급망 차질'],
      strategySummary: {
        stance: '분할 관심',
        rationale: '정책 기대가 먼저 반영될 수 있어 실적 확인 구간과 나눠 접근한다.',
        watchlist: [`${q} 대표 기업`, `${q} 부품·소재 기업`],
        riskWarning: '기대가 먼저 반영된 구간에서는 실적 발표 전후의 변동성을 먼저 확인한다.',
      },
    },
    reportLabel: `${q} 샘플 리포트`,
  };
}

const TOPICS = [MIDDLE_EAST, AI_INFRA];
const genericTopics = new Map<string, Topic>();

function findTopic(query: string): Topic {
  const q = query.trim().toLowerCase();
  const found = TOPICS.find((topic) =>
    [...topic.keywords, ...topic.match].some((kw) => {
      const k = kw.toLowerCase();
      return k === q || (q.length >= 2 && (k.includes(q) || q.includes(k)));
    }),
  );
  if (found) return found;
  const key = query.trim();
  if (!genericTopics.has(key)) genericTopics.set(key, genericTopic(key));
  return genericTopics.get(key)!;
}

// ── 기사 등록부 ─────────────────────────────────────────────────────
// 펼치기·재검색은 기사 ID만 받는다. 어느 주제·가지의 몇 번째 제목부터 낼지는 여기 기록한다.

type Entry = { topic: Topic; kind: 'root' } | { topic: Topic; kind: 'branch'; branch: number; off: number };

const registry = new Map<string, Entry>();
let childSeq = 0;

function register(news: NewsCard, entry: Entry): NewsCard {
  registry.set(news.id, entry);
  return news;
}

// ── mock API ───────────────────────────────────────────────────────

/** GET /keywords/recommended 대응 */
export async function fetchMockRecommendedKeywords(limit = 8): Promise<string[]> {
  await wait(LATENCY.keywords);
  return MOCK_HOME_KEYWORDS.slice(0, limit);
}

/** 검색어 → 키워드맵. 검색어를 가운데에 두고 같은 주제의 키워드 8개를 붙인다. */
export async function fetchMockKeywordMap(query: string): Promise<MockKeywordMap> {
  const q = query.trim() || DEFAULT_QUERY;
  await wait(LATENCY.keywords);
  const topic = findTopic(q);
  return { query: q, keywords: unique([q, ...topic.keywords]).slice(0, 9) };
}

/** GET /news/search + 중앙 기사의 /related 대응 */
export async function fetchMockNewsMap(keyword: string): Promise<MockNewsMap> {
  const q = keyword.trim() || DEFAULT_QUERY;
  await wait(LATENCY.search);
  const topic = findTopic(q);
  register(topic.root, { topic, kind: 'root' });
  return {
    keyword: q,
    topicId: topic.id,
    root: topic.root,
    related: rootSet(topic, 0),
    reportTitle: topic.report.title,
    reportLabel: topic.reportLabel,
  };
}

/**
 * 카드 기준 연관 뉴스. 처음 펼치면 batch 0, 다시 검색할 때마다 batch가 1씩 오른다.
 * 중앙 카드는 연관 뉴스 4건, 나머지 카드는 같은 가지의 하위 뉴스 3건을 낸다.
 */
export async function fetchMockRelated(newsId: string, batch: number, { research = false } = {}): Promise<NewsCard[]> {
  await wait(research ? LATENCY.research : LATENCY.expand);
  const entry = registry.get(newsId);
  if (!entry) throw new Error('연관 뉴스를 찾을 기사가 없습니다.');
  if (entry.kind === 'root') return rootSet(entry.topic, batch);

  const { topic, branch, off } = entry;
  const pool = topic.pools[branch];
  const start = off + batch * 3;
  return [0, 1, 2].map((i) =>
    register(
      sample(`${topic.id}-b${branch}-${childSeq++}`, pool[(start + i) % pool.length], topic.branchTones[branch], topic.branchKeywords[branch]),
      { topic, kind: 'branch', branch, off: (start + 3 + i * 4) % pool.length },
    ),
  );
}

function rootSet(topic: Topic, batch: number): NewsCard[] {
  return topic.rootSets[batch % 2].map(({ news, branch }, i) =>
    register(news, { topic, kind: 'branch', branch, off: i * 5 }),
  );
}

/** 근거가 1건이면 그 기사 제목으로, 여러 건이면 주제 리포트 제목을 쓴다. */
export function mockReportTitle(map: Pick<MockNewsMap, 'reportTitle'>, evidence: NewsCard[]): string {
  if (evidence.length > 1) return map.reportTitle;
  return evidence[0] ? `${evidence[0].title} — 영향 리포트` : '';
}

/**
 * POST /reports → GET /reports/{id} 대응. 본문 추출 → 분석 → 전략 단계를 차례로 알린다.
 * 리포트 본문은 근거와 관계없이 주제의 목업 리포트다.
 */
export async function generateMockReport(
  map: Pick<MockNewsMap, 'reportTitle'>,
  evidence: NewsCard[],
  onPhase: (phase: ReportPhase) => void,
  signal?: AbortSignal,
): Promise<Report> {
  if (!evidence.length) throw new Error('리포트에 쓸 근거 뉴스가 없습니다.');
  const entry = registry.get(evidence[0].id);
  const topic = entry?.topic ?? MIDDLE_EAST;
  for (const phase of [1, 2] as const) {
    await wait(LATENCY.reportStep, signal);
    onPhase(phase);
  }
  await wait(LATENCY.reportStep, signal);
  return {
    ...topic.report,
    id: `${topic.report.id}-${evidence.map((news) => news.id).join('+')}`,
    title: mockReportTitle(map, evidence),
  };
}

// ── 유틸 ───────────────────────────────────────────────────────────

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms * latencyScale);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function slug(value: string): string {
  return encodeURIComponent(value.toLowerCase().trim()).replace(/%/g, '');
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const v = value.trim();
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}
