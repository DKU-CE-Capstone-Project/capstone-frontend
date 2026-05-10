export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export type NewsCard = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  mockOriginalBody: string;
  thumbnailTone: 'oil' | 'chip' | 'ai' | 'defense' | 'shipping' | 'currency';
  imageUrl: string;
  keywords: string[];
  relatedStockSymbols: string[];
  sentiment: Sentiment;
};

export type IssueCluster = {
  id: string;
  query: string;
  mainNewsId: string;
  relatedNewsIds: string[];
  recommendedKeywords: string[];
  reportId: string;
};

export type Report = {
  id: string;
  clusterId: string;
  title: string;
  eventSummary: string;
  marketImpact: string;
  stockImpacts: Array<{
    symbol: string;
    name: string;
    impact: string;
    direction: 'up' | 'down' | 'mixed';
  }>;
  riskFactors: string[];
  strategySummary: {
    stance: string;
    rationale: string;
    watchlist: string[];
    riskWarning: string;
  };
};

export const newsCards: NewsCard[] = [
  {
    id: 'oil-1',
    title: '중동 항로 긴장 재점화, 원유 선물 장중 급등',
    source: 'Global Market Wire',
    publishedAt: '2026-04-28 09:30',
    summary:
      '호르무즈 해협 주변 긴장이 다시 높아지며 국제 유가와 에너지 관련 종목이 동반 상승했다.',
    mockOriginalBody:
      '중동 항로의 군사적 긴장이 재점화되면서 브렌트유 선물은 장중 4% 가까이 상승했다. 시장은 해상 운송 차질 가능성과 재고 부담을 동시에 반영하고 있으며, 정유·해운·방산 업종으로 단기 수급이 이동하는 모습이다.',
    thumbnailTone: 'oil',
    imageUrl:
      'https://images.unsplash.com/photo-1516937941344-00b4e0337589?auto=format&fit=crop&w=520&q=80',
    keywords: ['원유', '중동', '해협', '에너지'],
    relatedStockSymbols: ['XOM', 'OIL', 'KRX:096770'],
    sentiment: 'negative',
  },
  {
    id: 'oil-2',
    title: '정유사 마진 개선 기대, 에너지주 강세',
    source: 'Market Desk',
    publishedAt: '2026-04-28 10:10',
    summary:
      '공급 차질 우려가 정제 마진 개선 기대를 키우며 정유주와 에너지 ETF에 매수세가 유입됐다.',
    mockOriginalBody:
      '국제 유가 상승과 공급 불확실성이 동시에 커지면서 정유사들의 단기 마진 개선 가능성이 부각됐다. 다만 원재료 가격 부담이 장기화될 경우 소비 둔화로 이어질 수 있어 추세 지속 여부는 재고 지표에 달려 있다.',
    thumbnailTone: 'oil',
    imageUrl:
      'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=520&q=80',
    keywords: ['정유', '마진', 'ETF', '재고'],
    relatedStockSymbols: ['XLE', 'KRX:010950'],
    sentiment: 'positive',
  },
  {
    id: 'oil-3',
    title: '해운 운임지수 반등, 우회 항로 비용 반영',
    source: 'Trade Journal',
    publishedAt: '2026-04-28 11:40',
    summary:
      '항로 리스크가 커지며 해운 운임지수가 반등했고 물류비 상승 가능성이 제기됐다.',
    mockOriginalBody:
      '주요 선사들은 위험 지역 통과 비용과 보험료 상승분을 운임에 반영하기 시작했다. 우회 항로가 확대되면 배송 기간이 길어지고 수출입 기업의 비용 부담도 커질 수 있다.',
    thumbnailTone: 'shipping',
    imageUrl:
      'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=520&q=80',
    keywords: ['해운', '운임', '물류비', '보험료'],
    relatedStockSymbols: ['KRX:011200', 'KRX:028670'],
    sentiment: 'mixed',
  },
  {
    id: 'oil-4',
    title: '방산 수주 기대감 확대, 관련주 거래량 증가',
    source: 'Security Brief',
    publishedAt: '2026-04-28 12:15',
    summary:
      '지정학적 불확실성이 방산 장비 수요 기대를 키우며 관련 종목 거래량이 늘었다.',
    mockOriginalBody:
      '중동 지역 긴장 고조 이후 방공·감시 장비 관련 기업에 관심이 집중됐다. 단기 테마성 수급이 강하지만 실제 수주로 연결되는지 확인이 필요하다.',
    thumbnailTone: 'defense',
    imageUrl:
      'https://images.unsplash.com/photo-1517976547714-720226b864c1?auto=format&fit=crop&w=520&q=80',
    keywords: ['방산', '수주', '감시 장비', '지정학'],
    relatedStockSymbols: ['KRX:012450', 'LMT'],
    sentiment: 'positive',
  },
  {
    id: 'ai-1',
    title: '빅테크 AI 서버 투자 확대, HBM 수요 전망 상향',
    source: 'Tech Signal',
    publishedAt: '2026-04-29 08:50',
    summary:
      '대형 클라우드 기업의 서버 증설 계획이 공개되며 고대역폭 메모리와 전력 인프라 수요 전망이 상향됐다.',
    mockOriginalBody:
      'AI 데이터센터 투자가 다시 가속화되고 있다. 시장은 GPU, HBM, 전력 장비, 냉각 솔루션까지 이어지는 공급망 전반의 수혜 가능성을 가격에 반영하고 있다.',
    thumbnailTone: 'ai',
    imageUrl:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=520&q=80',
    keywords: ['AI 서버', 'HBM', '데이터센터', '전력'],
    relatedStockSymbols: ['NVDA', 'KRX:005930', 'KRX:000660'],
    sentiment: 'positive',
  },
  {
    id: 'ai-2',
    title: '전력 인프라 병목, 데이터센터 증설 변수로 부상',
    source: 'Grid Watch',
    publishedAt: '2026-04-29 10:05',
    summary:
      '전력망 증설 속도가 AI 서버 수요를 따라가지 못하면서 전력 장비 업체가 주목받고 있다.',
    mockOriginalBody:
      '데이터센터가 요구하는 전력 밀도가 높아지며 변압기, 배전반, 냉각 장비 수급이 새로운 병목으로 떠올랐다. 투자자들은 반도체뿐 아니라 전력 인프라 밸류체인으로 관심을 넓히고 있다.',
    thumbnailTone: 'ai',
    imageUrl:
      'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=520&q=80',
    keywords: ['전력망', '변압기', '데이터센터', '냉각'],
    relatedStockSymbols: ['ETN', 'KRX:010120'],
    sentiment: 'positive',
  },
  {
    id: 'ai-3',
    title: '반도체 장비 리드타임 단축, 공급 안정 기대',
    source: 'Semicon Daily',
    publishedAt: '2026-04-29 11:25',
    summary:
      '핵심 장비 리드타임이 일부 단축되며 AI 반도체 공급망 안정 기대가 커졌다.',
    mockOriginalBody:
      '장비 공급 병목이 완화되면 고성능 메모리 증설 일정의 가시성이 높아질 수 있다. 다만 선단 공정 장비와 패키징 장비는 여전히 수요가 공급을 앞서는 상황이다.',
    thumbnailTone: 'chip',
    imageUrl:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=520&q=80',
    keywords: ['반도체 장비', '공급망', '패키징', 'HBM'],
    relatedStockSymbols: ['ASML', 'AMAT', 'KRX:042700'],
    sentiment: 'neutral',
  },
  {
    id: 'currency-1',
    title: '달러 강세 재개, 수입 물가 부담 확대',
    source: 'FX Monitor',
    publishedAt: '2026-04-29 13:00',
    summary:
      '위험 회피 심리가 강해지며 달러가 상승했고 원자재 수입 기업의 비용 부담이 확대됐다.',
    mockOriginalBody:
      '달러 강세는 에너지 가격 상승과 결합될 경우 수입 물가 부담을 키운다. 환율 변동성이 커지면 항공, 화학, 유통 업종의 마진 전망도 조정될 수 있다.',
    thumbnailTone: 'currency',
    imageUrl:
      'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=520&q=80',
    keywords: ['달러', '환율', '수입 물가', '위험 회피'],
    relatedStockSymbols: ['DXY', 'KRW'],
    sentiment: 'negative',
  },
];

export const clusters: IssueCluster[] = [
  {
    id: 'middle-east-oil',
    query: '중동 전황',
    mainNewsId: 'oil-1',
    relatedNewsIds: ['oil-2', 'oil-3', 'oil-4'],
    recommendedKeywords: [
      '중동 전황',
      '원유',
      '해운',
      '방산',
      '환율',
      '정유',
      '에너지 ETF',
      '운임',
      '물류비',
      '해협 리스크',
      '수입 물가',
    ],
    reportId: 'report-oil',
  },
  {
    id: 'ai-infra',
    query: 'AI 서버',
    mainNewsId: 'ai-1',
    relatedNewsIds: ['ai-2', 'ai-3', 'currency-1'],
    recommendedKeywords: [
      'AI 서버',
      'HBM',
      '전력망',
      '반도체 장비',
      '환율',
      '데이터센터',
      '냉각',
      'GPU',
      '패키징',
      '변압기',
      '클라우드',
    ],
    reportId: 'report-ai',
  },
];

export const reports: Report[] = [
  {
    id: 'report-oil',
    clusterId: 'middle-east-oil',
    title: '중동 항로 긴장과 에너지·물류 영향 리포트',
    eventSummary:
      '호르무즈 해협 주변 긴장이 원유 공급 차질 우려로 연결되며 에너지, 해운, 방산 섹터의 단기 수급을 자극했다.',
    marketImpact:
      '유가 상승은 정유 마진에는 단기 호재지만 물류비와 수입 물가 상승으로 제조·소비재 업종에는 부담이 될 수 있다.',
    stockImpacts: [
      {
        symbol: 'KRX:096770',
        name: 'SK이노베이션',
        impact: '정제 마진 개선 기대와 원재료 부담이 동시에 반영된다.',
        direction: 'mixed',
      },
      {
        symbol: 'KRX:011200',
        name: 'HMM',
        impact: '운임 상승은 매출에 긍정적이나 우회 항로 비용이 변수다.',
        direction: 'mixed',
      },
      {
        symbol: 'KRX:012450',
        name: '한화에어로스페이스',
        impact: '방산 수요 기대가 단기 모멘텀으로 작동할 수 있다.',
        direction: 'up',
      },
    ],
    riskFactors: ['유가 급락 반전', '정치적 완화 신호', '보험료와 운임 비용 장기화'],
    strategySummary: {
      stance: '선별 관망',
      rationale:
        '에너지와 방산은 이벤트 민감도가 높고, 해운은 비용과 운임이 동시에 움직여 확인이 필요하다.',
      watchlist: ['정유', '해운', '방산', '환율 민감 소비재'],
      riskWarning:
        '단기 지정학 뉴스는 반전 속도가 빠르므로 추격 매수보다 리스크 구간을 먼저 확인한다.',
    },
  },
  {
    id: 'report-ai',
    clusterId: 'ai-infra',
    title: 'AI 서버 투자 확대와 반도체·전력 인프라 리포트',
    eventSummary:
      '빅테크의 AI 서버 투자 확대가 HBM, GPU, 전력 장비, 냉각 인프라 수요 전망을 동시에 끌어올렸다.',
    marketImpact:
      '반도체 수요는 긍정적이나 전력망 병목과 환율 변동이 설비 투자 일정과 비용 구조에 영향을 줄 수 있다.',
    stockImpacts: [
      {
        symbol: 'KRX:005930',
        name: '삼성전자',
        impact: 'HBM 경쟁력 회복 여부가 주가 반응의 핵심 변수다.',
        direction: 'mixed',
      },
      {
        symbol: 'KRX:000660',
        name: 'SK하이닉스',
        impact: 'HBM 수요 전망 상향의 직접 수혜 후보로 평가된다.',
        direction: 'up',
      },
      {
        symbol: 'KRX:010120',
        name: 'LS ELECTRIC',
        impact: '전력 인프라 병목이 장비 수요 증가 기대를 만든다.',
        direction: 'up',
      },
    ],
    riskFactors: ['서버 투자 지연', '전력망 인허가 지연', '반도체 공급 과잉 우려'],
    strategySummary: {
      stance: '분할 관심',
      rationale:
        'AI 인프라 투자는 장기 추세지만 종목별 밸류에이션 부담이 달라 분할 접근이 적합하다.',
      watchlist: ['HBM', '전력 장비', '냉각 인프라', '반도체 장비'],
      riskWarning:
        '투자 계획 발표와 실제 발주 사이에는 시차가 있으므로 실적 확인 구간을 분리한다.',
    },
  },
];

export function getNews(id: string) {
  return newsCards.find((news) => news.id === id) ?? newsCards[0];
}

export function getCluster(id: string) {
  return clusters.find((cluster) => cluster.id === id) ?? clusters[0];
}

export function getReport(id: string) {
  return reports.find((report) => report.id === id) ?? reports[0];
}

export function findClusterByQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return clusters[0];
  }

  return (
    clusters.find((cluster) => {
      const keywordMatch = cluster.recommendedKeywords.some((keyword) =>
        keyword.toLowerCase().includes(normalized),
      );
      return cluster.query.toLowerCase().includes(normalized) || keywordMatch;
    }) ?? clusters[0]
  );
}
