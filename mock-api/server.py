"""프론트엔드 UI 작업용 mock API 서버.

`capstone-backend`의 `/api/v1` 응답 스키마(app/schemas.py)를 그대로 흉내 낸다.
표준 라이브러리만 쓴다 — 의존성 설치가 없어 python:alpine 에서 바로 뜬다.

실제 백엔드에도 mock 모드(`USE_MOCK_NEWS=true`)가 있지만 google-genai,
anthropic, trafilatura, lxml 등을 설치해야 해서 프론트만 만질 때는 과하다.
"실제 API 동작을 검증"하려면 이 서버가 아니라 진짜 백엔드를 써야 한다.

썸네일도 이 서버가 SVG로 직접 만들어 준다(/api/v1/thumbnails/...).
외부 이미지 호스트에 의존하지 않으므로 폐쇄망에서도 화면이 그대로 나온다.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PORT = 8000
HOST = os.environ.get("MOCK_API_HOST") or "127.0.0.1"

# ── 더미 데이터 ──────────────────────────────────────────────────────
# 프론트의 hasBackendFallbackText()는 본문에 "AI 분석 준비 중",
# "생성하지 못했습니다", "기본 포트폴리오 전략"이 들어 있으면 응답을 버리고
# 자체 mock 리포트로 갈아탄다. 아래 문구에 그 표현을 쓰지 말 것.

BASE_TIME = datetime(2026, 9, 20, 9, 0, tzinfo=timezone.utc)


def _at(minutes: int) -> str:
    return (BASE_TIME + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


NEWS = [
    # ── AI · 반도체 ──────────────────────────────────────────────
    {
        "news_id": "n-ai-001",
        "title": "빅테크 AI 서버 증설 계획 공개, HBM 수요 전망 상향",
        "summary": "대형 클라우드 3사가 내년 서버 증설 계획을 동시에 공개하면서 고대역폭 메모리와 전력 인프라 수요 전망이 함께 올라갔다.",
        "body": "대형 클라우드 사업자들이 내년 데이터센터 증설 규모를 예상보다 크게 잡으면서 HBM, 전력 장비, 냉각 설비까지 수요 전망이 동반 상향됐다. 증권가는 메모리 3사의 공급 계약이 내년 상반기에 집중될 것으로 보고 있으나, 전력망 인입 일정이 실제 납기를 좌우할 변수로 꼽힌다.",
        "source_name": "연합뉴스",
        "tone": "ai",
        "stocks": ["삼성전자", "SK하이닉스", "LS ELECTRIC"],
        "topics": ["AI 서버", "반도체", "HBM", "엔비디아", "데이터센터"],
        "offset": 0,
    },
    {
        "news_id": "n-ai-002",
        "title": "삼성전자·SK하이닉스, HBM4 양산 경쟁 본격화",
        "summary": "두 회사가 HBM4 양산 시점을 앞당기겠다고 밝히면서 차세대 메모리 주도권 경쟁이 빨라지고 있다.",
        "body": "HBM4는 기존 대비 대역폭과 전력 효율이 모두 개선된 규격으로, 양산 시점이 곧 고객사 물량 배분으로 이어진다. 다만 수율이 초기 원가를 좌우하기 때문에 첫 분기 실적만으로 우위를 판단하기는 이르다는 평가가 많다.",
        "source_name": "매일경제",
        "tone": "chip",
        "stocks": ["삼성전자", "SK하이닉스"],
        "topics": ["반도체", "HBM", "AI 서버"],
        "offset": 35,
    },
    {
        "news_id": "n-ai-003",
        "title": "AI 데이터센터 전력 수요 급증, 전력 인프라 병목 우려",
        "summary": "데이터센터 전력 수요가 빠르게 늘면서 변압기와 송배전 설비 공급이 증설 속도를 따라가지 못한다는 지적이 나온다.",
        "body": "전력 기자재 업계는 주문 잔고가 2년치를 넘어섰다고 밝혔다. 증설 계획이 발표돼도 전력 인입이 지연되면 가동 시점이 밀리기 때문에, 설비 투자 일정과 전력 계약을 함께 봐야 한다는 조언이 나온다.",
        "source_name": "이데일리",
        "tone": "defense",
        "stocks": ["LS ELECTRIC", "HD현대일렉트릭"],
        "topics": ["AI 서버", "데이터센터", "전력망"],
        "offset": 70,
    },
    {
        "news_id": "n-ai-004",
        "title": "반도체 장비 수주 증가, 소부장 기업으로 온기 확산",
        "summary": "전공정 장비 발주가 늘면서 국내 소재·부품·장비 기업들의 수주 잔고가 함께 늘고 있다.",
        "body": "장비 발주는 통상 2~3개 분기 뒤 매출로 잡힌다. 지금 늘어난 잔고가 실적으로 확인되는 시점은 내년 중반 이후이며, 그 사이 메모리 가격 흐름이 변수로 남아 있다.",
        "source_name": "한국경제",
        "tone": "chip",
        "stocks": ["한미반도체", "주성엔지니어링"],
        "topics": ["반도체", "AI 서버"],
        "offset": 105,
    },
    {
        "news_id": "n-ai-005",
        "title": "HBM 공급 계약 장기화, 메모리 가격 변동성 축소 전망",
        "summary": "고객사와의 장기 공급 계약 비중이 늘면서 메모리 가격이 분기마다 출렁이던 구조가 완화될 것이라는 분석이 나온다.",
        "body": "장기 계약은 가격 하단을 받쳐 주지만 상승장에서는 단가 인상을 늦춘다. 증권가는 계약 구조 변화가 실적 변동성을 줄이는 대신 호황기 수익률을 깎는 요인이 될 수 있다고 본다.",
        "source_name": "서울경제",
        "tone": "chip",
        "stocks": ["삼성전자", "SK하이닉스"],
        "topics": ["반도체", "HBM"],
        "offset": 140,
    },
    {
        "news_id": "n-ai-006",
        "title": "데이터센터 냉각 수요 증가, 공조 업체 수주 잔고 확대",
        "summary": "고집적 AI 서버가 늘면서 액침·수냉 방식 공조 설비 발주가 함께 늘고 있다.",
        "body": "공조 설비는 전력 인입과 함께 데이터센터 가동 시점을 좌우한다. 업계는 내년 발주가 올해보다 늘 것으로 보면서도, 설계 표준이 아직 정리되지 않아 초기 수주의 수익성은 편차가 크다고 설명한다.",
        "source_name": "머니투데이",
        "tone": "defense",
        "stocks": ["LS ELECTRIC", "HD현대일렉트릭"],
        "topics": ["AI 서버", "데이터센터", "전력망"],
        "offset": 175,
    },
    # ── 원유 · 중동 ──────────────────────────────────────────────
    {
        "news_id": "n-oil-001",
        "title": "중동 항로 긴장 재점화, 원유 선물 장중 급등",
        "summary": "호르무즈 해협 주변 긴장이 다시 높아지며 국제 유가와 에너지 관련 종목이 동반 상승했다.",
        "body": "브렌트유 선물은 장중 4% 가까이 올랐다. 시장은 해상 운송 차질 가능성과 재고 부담을 동시에 반영하고 있으며, 정유·해운·방산 업종으로 단기 수급이 이동하는 모습이다.",
        "source_name": "Global Market Wire",
        "tone": "oil",
        "stocks": ["S-Oil", "GS", "HMM"],
        "topics": ["원유", "중동 전황", "에너지", "해운"],
        "offset": 10,
    },
    {
        "news_id": "n-oil-002",
        "title": "정유사 마진 개선 기대, 에너지주 강세",
        "summary": "공급 차질 우려가 정제 마진 개선 기대를 키우며 정유주와 에너지 ETF에 매수세가 유입됐다.",
        "body": "국제 유가 상승과 공급 불확실성이 동시에 커지면서 정유사들의 단기 마진 개선 가능성이 부각됐다. 다만 원재료 가격 부담이 길어지면 소비 둔화로 이어질 수 있어 재고 지표를 함께 봐야 한다.",
        "source_name": "Market Desk",
        "tone": "oil",
        "stocks": ["S-Oil", "SK이노베이션"],
        "topics": ["원유", "정유", "에너지"],
        "offset": 45,
    },
    {
        "news_id": "n-oil-003",
        "title": "해운 운임지수 반등, 우회 항로 비용 반영",
        "summary": "항로 리스크가 커지며 해운 운임지수가 반등했고 물류비 상승 가능성이 제기됐다.",
        "body": "주요 선사들이 위험 구간 통과 비용과 보험료 상승분을 운임에 반영하기 시작했다. 우회 항로가 늘면 배송 기간이 길어지고 수출입 기업의 비용 부담도 커진다.",
        "source_name": "Trade Journal",
        "tone": "shipping",
        "stocks": ["HMM", "팬오션"],
        "topics": ["해운", "원유", "운임", "물류비"],
        "offset": 80,
    },
    {
        "news_id": "n-oil-004",
        "title": "방산 수주 기대감 확대, 관련주 거래량 증가",
        "summary": "지정학적 불확실성이 방산 장비 수요 기대를 키우며 관련 종목 거래량이 늘었다.",
        "body": "중동 지역 긴장 이후 방공·감시 장비 기업에 관심이 몰렸다. 단기 테마성 수급이 강한 만큼 실제 수주 공시로 이어지는지 확인이 필요하다.",
        "source_name": "Security Brief",
        "tone": "defense",
        "stocks": ["한화에어로스페이스", "LIG넥스원"],
        "topics": ["방산", "중동 전황"],
        "offset": 115,
    },
    {
        "news_id": "n-oil-005",
        "title": "정제 마진 반등, 정유사 실적 기대치 상향",
        "summary": "역내 정기 보수가 겹치면서 정제 마진이 회복돼 정유사 분기 실적 전망이 올라갔다.",
        "body": "정제 마진은 유가보다 정유사 수익성에 직접적이다. 다만 보수 일정이 끝나는 시점에 공급이 다시 늘면 마진이 되돌아설 수 있어, 추세로 보기에는 이르다는 신중론도 있다.",
        "source_name": "파이낸셜뉴스",
        "tone": "oil",
        "stocks": ["S-Oil", "GS"],
        "topics": ["원유", "정유", "에너지"],
        "offset": 150,
    },
    # ── 환율 · 금리 ──────────────────────────────────────────────
    {
        "news_id": "n-fx-001",
        "title": "원달러 환율 변동성 확대, 수입물가 부담 커져",
        "summary": "환율이 좁은 구간을 벗어나 움직이면서 원자재를 수입하는 업종의 원가 부담이 다시 부각됐다.",
        "body": "환율 상승은 수출 기업에 유리하게 작용하지만, 원자재를 달러로 결제하는 업종에는 원가 부담으로 돌아온다. 업종별 환 노출도를 나눠 볼 필요가 있다.",
        "source_name": "FX Daily",
        "tone": "currency",
        "stocks": ["대한항공", "포스코홀딩스"],
        "topics": ["환율", "금리", "수입 물가"],
        "offset": 25,
    },
    {
        "news_id": "n-fx-002",
        "title": "국고채 금리 하락, 채권 매수세 유입",
        "summary": "금리 인하 기대가 반영되며 국고채 금리가 내렸고 채권형 자금 유입이 늘었다.",
        "body": "금리 경로에 대한 시장 기대가 앞서가면 되돌림 폭도 커진다. 발표 지표가 기대와 어긋날 때의 변동성을 감안한 접근이 필요하다.",
        "source_name": "Bond Watch",
        "tone": "currency",
        "stocks": ["삼성증권", "미래에셋증권"],
        "topics": ["금리", "환율"],
        "offset": 60,
    },
    {
        "news_id": "n-fx-003",
        "title": "수입 물가 상승 압력, 환율·유가 동반 영향",
        "summary": "환율과 국제 유가가 함께 오르며 수입 물가 상승 압력이 커지고 있다는 분석이 나왔다.",
        "body": "수입 물가는 시차를 두고 소비자 물가로 넘어간다. 원가 부담을 판매가에 반영하기 어려운 업종부터 마진이 눌리기 때문에, 업종별 전가력을 함께 봐야 한다는 조언이 나온다.",
        "source_name": "아시아경제",
        "tone": "currency",
        "stocks": ["대한항공", "CJ제일제당"],
        "topics": ["환율", "수입 물가", "에너지"],
        "offset": 95,
    },
]

NEWS_BY_ID = {n["news_id"]: n for n in NEWS}

RECOMMENDED_KEYWORDS = [
    ("AI 서버", "technology"),
    ("반도체", "technology"),
    ("엔비디아", "company"),
    ("삼성전자", "company"),
    ("원유", "commodity"),
    ("중동 전황", "geopolitics"),
    ("환율", "macro"),
    ("금리", "macro"),
    ("해운", "industry"),
    ("방산", "industry"),
]

TONE_COLORS = {
    "ai": ("#1d8ba4", "#59c2b8"),
    "chip": ("#4a56a8", "#8b93d4"),
    "oil": ("#a8651b", "#d69a44"),
    "defense": ("#46693f", "#86a878"),
    "shipping": ("#2f6a8c", "#74a6c4"),
    "currency": ("#6a4a8f", "#a689c6"),
}

# 백엔드는 NCP 분류를 그대로 실어 보내고, 정치·사회 및 분류를 확인하지 못한 기사는
# 검색 단계에서 제외한다. mock 기사는 전부 경제·산업 계열이라 그에 맞춰 채운다.
CATEGORIES_BY_TONE = {
    "ai": ["IT/과학", "경제"],
    "chip": ["경제", "산업"],
    "oil": ["경제", "국제"],
    "defense": ["산업", "경제"],
    "shipping": ["산업", "경제"],
    "currency": ["경제", "금융"],
}


def _description(item: dict) -> str:
    """검색 API 가 주는 기사 설명(NCP description) 자리. 본문 앞부분을 잘라 쓴다.

    summary 는 백엔드가 만든 요약이고 description 은 검색 응답에 실려 오는
    원문 스니펫이다. 프론트 상세 화면은 description 을 "기사 설명"으로 낸다.
    """
    body = item["body"]
    return body if len(body) <= 160 else body[:159].rstrip() + "…"


def _source_url(item: dict) -> str:
    return f"https://news.example.com/{item['news_id']}"


# ── 응답 조립 ────────────────────────────────────────────────────────
def news_card(item: dict) -> dict:
    return {
        "description": _description(item),
        "news_id": item["news_id"],
        "title": item["title"],
        "summary": item["summary"],
        "thumbnail_url": f"/api/v1/thumbnails/{item['tone']}-{item['news_id']}.svg",
        "source_name": item["source_name"],
        "published_at": _at(item["offset"]),
        "related_stock_names": item["stocks"],
        "source_url": _source_url(item),
        "keywords": item["topics"],
        "categories": CATEGORIES_BY_TONE.get(item["tone"], ["경제"]),
    }


def search(query: str, size: int) -> list[dict]:
    """검색어가 topics/제목/종목에 걸리는 기사를 우선 배치한다."""
    q = query.strip().lower()
    if not q:
        return NEWS[:size]

    def score(item: dict) -> int:
        if any(q == t.lower() for t in item["topics"]):
            return 3
        if any(q in t.lower() for t in item["topics"]):
            return 2
        if q in item["title"].lower() or any(q in s.lower() for s in item["stocks"]):
            return 1
        return 0

    ranked = sorted(NEWS, key=lambda i: (-score(i), i["offset"]))
    hits = [i for i in ranked if score(i) > 0]

    # 좁은 검색어("엔비디아")는 1건만 걸린다. 그대로 두면 프론트가 연관 뉴스를
    # 자체 static mock 으로 채워서 전혀 다른 주제의 기사가 맵에 붙는다.
    # 같은 topic 을 공유하는 기사로 먼저 채워 실제 클러스터처럼 보이게 한다.
    if hits and len(hits) < 4:
        topics = {t for h in hits for t in h["topics"]}
        hits += [i for i in ranked if i not in hits and set(i["topics"]) & topics]

    # 검색어가 전혀 안 걸려도 빈 화면 대신 최신순으로 보여준다
    return (hits or NEWS)[:size]


def thumbnail_svg(tone: str, seed: str) -> bytes:
    start, end = TONE_COLORS.get(tone, TONE_COLORS["ai"])
    # seed로 원 위치를 흔들어 카드마다 조금씩 다르게 보이게 한다
    n = sum(ord(c) for c in seed)
    cx1, cy1 = 40 + n % 60, 30 + n % 40
    cx2, cy2 = 140 + n % 50, 70 + n % 30
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="200" height="120">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="{start}"/><stop offset="100%" stop-color="{end}"/>
  </linearGradient></defs>
  <rect width="200" height="120" fill="url(#g)"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1.5">
    <circle cx="{cx1}" cy="{cy1}" r="38"/><circle cx="{cx2}" cy="{cy2}" r="46"/>
  </g>
</svg>""".encode()


# 생성된 리포트·전략을 메모리에 들고 있는다 (재시작하면 사라진다)
REPORTS: dict[str, dict] = {}
STRATEGIES: dict[str, dict] = {}


def build_report(report_id: str, req: dict) -> dict:
    center = NEWS_BY_ID.get(req.get("news_id", ""), NEWS[0])
    related = [NEWS_BY_ID[i] for i in req.get("related_news_ids", []) if i in NEWS_BY_ID]
    stocks = req.get("ticker_symbols") or center["stocks"]

    return {
        "report_id": report_id,
        "title": f"{center['title']} — 투자 분석 리포트",
        "summary": center["summary"],
        "event_analysis": center["body"],
        "market_impact": (
            f"{', '.join(center['topics'][:2])} 관련 수급이 단기적으로 몰리는 구간이다. "
            "다만 원가·환율·전력 인입 같은 비용 변수는 아직 해소되지 않아, "
            "테마 전체보다 종목별 실적 확인이 먼저 필요하다."
        ),
        "related_stocks": stocks,
        "evidence_news": [
            {"news_id": n["news_id"], "title": n["title"], "source_name": n["source_name"]}
            for n in [center, *related][:5]
        ],
        "risk_factors": [
            "수주 잔고가 실제 매출로 확정되는 시점의 불확실성",
            "환율 변동에 따른 원가 부담",
            "단기 테마성 수급 쏠림에 따른 되돌림",
        ],
        "created_at": _at(200),
        "rag_sources": [],
        "verification": None,
    }


def build_strategy(strategy_id: str, req: dict) -> dict:
    report = REPORTS.get(req.get("report_id", ""), {})
    stocks = report.get("related_stocks") or NEWS[0]["stocks"]
    # 의견별로 코멘트를 다르게 둔다 — 카드마다 같은 문장이 반복되면
    # 프론트의 종목 카드 렌더를 제대로 확인할 수 없다.
    plan = [
        ("buy", "수요 전망 상향의 직접 수혜 구간으로 평가된다."),
        ("hold", "실적이 확인되기 전까지는 보유 관점이 적절하다."),
        ("watch", "비용 변수와 수혜가 동시에 걸려 있어 확인이 필요하다."),
    ]

    return {
        "strategy_id": strategy_id,
        "expected_return": 6.4,
        "risk": req.get("risk_level", "medium"),
        "period": req.get("period", "short"),
        "strategy_summary": (
            "이벤트 민감도가 높은 종목과 실적이 먼저 확인되는 종목을 나눠 접근한다. "
            "한 번에 비중을 싣기보다 확인 지표가 나올 때마다 단계적으로 늘리는 쪽이 맞다."
        ),
        "strategy_items": [
            {
                "ticker": s,
                "stock_name": s,
                "action": plan[i % len(plan)][0],
                "reason": plan[i % len(plan)][1],
            }
            for i, s in enumerate(stocks)
        ],
        "created_at": _at(210),
    }


# ── HTTP 핸들러 ──────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = "econmind-mock/1.0"

    # npm run dev(5173)에서 이 서버를 직접 부를 때를 위해 열어 둔다.
    # nginx 뒤에서는 동일 출처라 필요 없다.
    def _cors(self) -> None:
        # 프론트가 credentials: 'include' 로 부른다(세션 쿠키). 브라우저는 그때
        # 와일드카드 Origin 을 거부하므로 요청 Origin 을 그대로 돌려준다 —
        # 실제 백엔드의 CORSMiddleware(allow_credentials=True)도 같은 동작이다.
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        if origin:
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")

    def _send(self, status: int, payload, content_type="application/json") -> None:
        body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        url = urlparse(self.path)
        path = url.path
        qs = parse_qs(url.query)

        if path in ("/health", "/api/v1/health"):
            return self._send(200, {"status": "ok", "mode": "mock"})

        # 실제 백엔드는 여기서 MongoDB ping 결과를 낸다(실패 시 503).
        # mock 은 저장소가 없으니 항상 ok 다.
        if path == "/ready":
            return self._send(200, {"status": "ok", "mongodb": "mock"})

        if path == "/api/v1/keywords/recommended":
            limit = int(qs.get("limit", ["8"])[0])
            return self._send(200, {
                "keywords": [
                    {"keyword": k, "category": c, "rank": i + 1}
                    for i, (k, c) in enumerate(RECOMMENDED_KEYWORDS[:limit])
                ]
            })

        if path == "/api/v1/news/search":
            q = qs.get("q", [""])[0]
            size = max(1, min(int(qs.get("size", ["20"])[0]), 50))
            hits = search(q, size)
            return self._send(200, {
                "news_cards": [news_card(n) for n in hits],
                "total_count": len(hits),
            })

        if path in ("/api/v1/news/cards",):
            return self._send(200, {
                "news_cards": [news_card(n) for n in NEWS],
                "total_count": len(NEWS),
            })

        m = re.fullmatch(r"/api/v1/thumbnails/([a-z]+)-(.+)\.svg", path)
        if m:
            return self._send(200, thumbnail_svg(m.group(1), m.group(2)), "image/svg+xml")

        m = re.fullmatch(r"/api/v1/news/([^/]+)/source", path)
        if m:
            item = NEWS_BY_ID.get(m.group(1))
            if not item:
                return self._send(404, {"detail": "news not found"})
            return self._send(200, {
                "news_id": item["news_id"],
                "source_name": item["source_name"],
                "source_url": _source_url(item),
                "published_at": _at(item["offset"]),
                "original_title": item["title"],
                "thumbnail_url": f"/api/v1/thumbnails/{item['tone']}-{item['news_id']}.svg",
                # 실제 백엔드는 /source 에서 Diffbot 을 부르지 않는다 — 항상 빈 문자열이다.
                # 본문 추출은 POST /reports 단계로 옮겨졌다.
                "original_body": "",
                "description": _description(item),
                "keywords": item["topics"],
                "categories": CATEGORIES_BY_TONE.get(item["tone"], ["경제"]),
            })

        m = re.fullmatch(r"/api/v1/news/([^/]+)/graph", path)
        if m:
            item = NEWS_BY_ID.get(m.group(1), NEWS[0])
            limit = max(1, min(int(qs.get("limit", ["10"])[0]), 30))

            # 실제 백엔드의 이웃 풀은 "같은 검색어로 캐시된 기사"다
            # (news._related_articles). 그래서 다른 주제의 기사가 섞이지 않는다.
            # distance 는 제목 토큰 겹침이 0.4 이상이면 1, 아니면 2
            # (graph_builder._distance). /related 는 FREE 에서 3건만 주므로
            # 맵의 나머지 노드는 이 응답에서 채워진다.
            def rank(n: dict) -> tuple:
                return (-len(set(n["topics"]) & set(item["topics"])), n["offset"])

            neighbours = sorted(
                (n for n in NEWS if n is not item and set(n["topics"]) & set(item["topics"])),
                key=rank,
            )[:limit]
            distances = {
                n["news_id"]: 1 if len(set(n["topics"]) & set(item["topics"])) >= 2 else 2
                for n in neighbours
            }
            node = lambda n, d, c=False: {  # noqa: E731
                "news_id": n["news_id"], "title": n["title"], "summary": n["summary"],
                "distance": d, "is_center": c,
            }
            return self._send(200, {
                "center_node": node(item, 0, True),
                "nodes": [
                    node(item, 0, True),
                    *[node(n, distances[n["news_id"]]) for n in neighbours],
                ],
                "edges": [
                    {
                        "source": item["news_id"],
                        "target": n["news_id"],
                        "relation_type": "same_topic" if distances[n["news_id"]] == 1 else "related_topic",
                        "distance": distances[n["news_id"]],
                    }
                    for n in neighbours
                ],
            })

        m = re.fullmatch(r"/api/v1/news/([^/]+)/related", path)
        if m:
            item = NEWS_BY_ID.get(m.group(1), NEWS[0])
            limit = int(qs.get("limit", ["10"])[0])
            tier = qs.get("tier", ["FREE"])[0]
            include_score = qs.get("include_score", ["false"])[0].lower() == "true"

            # 실제 백엔드는 FREE/BASIC 에서 limit 을 3 으로 깎고 relevance_score 를
            # 주지 않는다. 그대로 흉내 내지 않으면 맵이 /related 만으로 다 차서,
            # 프론트의 graph 이웃 보충 경로가 mock 에서 한 번도 실행되지 않는다.
            is_paid = tier == "PAID"
            effective_limit = limit if is_paid else min(limit, 3)
            neighbours = [
                n for n in NEWS if n is not item and set(n["topics"]) & set(item["topics"])
            ][:effective_limit]

            def score(i: int):
                if not (is_paid or include_score):
                    return None
                return round(0.9 - 0.07 * i, 2) if is_paid else None

            return self._send(200, {
                "related_news": [
                    {
                        "news_id": n["news_id"], "title": n["title"], "summary": n["summary"],
                        "thumbnail_url": f"/api/v1/thumbnails/{n['tone']}-{n['news_id']}.svg",
                        "relevance_score": score(i),
                        "distance": 1,
                    }
                    for i, n in enumerate(neighbours)
                ]
            })

        m = re.fullmatch(r"/api/v1/reports/([^/]+)", path)
        if m:
            report = REPORTS.get(m.group(1))
            if not report:
                return self._send(404, {"detail": "report not found"})
            return self._send(200, report)

        m = re.fullmatch(r"/api/v1/strategies/([^/]+)", path)
        if m:
            strategy = STRATEGIES.get(m.group(1))
            if not strategy:
                return self._send(404, {"detail": "strategy not found"})
            return self._send(200, strategy)

        return self._send(404, {"detail": f"no mock route for {path}"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length", "0") or 0)
        try:
            req = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, {"detail": "invalid json"})

        if path == "/api/v1/reports":
            report_id = f"rep-{uuid.uuid4().hex[:8]}"
            REPORTS[report_id] = build_report(report_id, req)
            return self._send(201, {
                "report_id": report_id, "status": "completed", "created_at": _at(200),
            })

        if path == "/api/v1/strategies":
            strategy_id = f"str-{uuid.uuid4().hex[:8]}"
            STRATEGIES[strategy_id] = build_strategy(strategy_id, req)
            return self._send(201, {
                "strategy_id": strategy_id, "status": "completed", "created_at": _at(210),
            })

        return self._send(404, {"detail": f"no mock route for {path}"})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[mock] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}", flush=True)


if __name__ == "__main__":
    print(f"[mock] econmind mock API on :{PORT} — {len(NEWS)} articles", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
