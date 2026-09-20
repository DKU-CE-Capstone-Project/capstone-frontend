# Capstone Frontend

실시간 뉴스 기반 멀티 에이전트 투자 판단 지원 시스템의 프론트엔드입니다.

React, TypeScript, Vite 기반으로 구현되어 있으며, 백엔드의 9주차 API 명세서 기준 `/api/v1` 엔드포인트와 연결됩니다.

## 기술 스택

- React 19
- TypeScript
- Vite
- lucide-react (아이콘)
- motion (화면 전환·맵 노드 애니메이션)

## 시작하기

### 1. 저장소 클론

```bash
git clone <frontend-repository-url>
cd capstone-frontend
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 백엔드 실행

프론트엔드는 기본적으로 백엔드 API를 `http://localhost:8000/api/v1`에서 호출합니다.

백엔드 저장소를 별도로 클론한 뒤, 백엔드 서버를 먼저 실행해야 합니다.

```bash
cd capstone-backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

백엔드가 정상 실행되면 다음 주소에서 상태를 확인할 수 있습니다.

```text
http://127.0.0.1:8000/health
```

### 4. 프론트엔드 실행

기본 Vite 포트로 실행:

```bash
npm run dev
```

5173 대신 5174 포트로 실행:

```bash
npm run dev -- --host 127.0.0.1 --port 5174
```

브라우저에서 접속:

```text
http://127.0.0.1:5174/
```

## 환경 변수

API 서버 주소는 `VITE_API_BASE`로 변경할 수 있습니다.

예시:

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5174
```

또는 `.env.local` 파일을 생성해 사용할 수 있습니다.

```env
VITE_API_BASE=http://127.0.0.1:8000
```

환경 변수를 지정하지 않으면 기본값으로 `http://localhost:8000`을 사용합니다.

## 주요 화면 흐름

1. 홈 화면
   - 추천 키워드를 `GET /api/v1/keywords/recommended`에서 가져옵니다.
   - API 호출 실패 시 `src/data/mockData.ts`의 기본 추천 키워드를 사용합니다.

2. 검색 결과
   - 키워드 검색 시 `GET /api/v1/news/search`를 호출합니다.
   - 백엔드 응답을 프론트 내부 `IssueCluster`, `NewsCard` 형태로 변환합니다.
   - 뉴스 카드 이미지는 백엔드의 `thumbnail_url`을 우선 사용하고, 없을 때만 프론트 fallback 이미지를 사용합니다.

3. 뉴스맵
   - 키워드 맵에서 넘어온 `GET /api/v1/news/search` 결과를 중심 뉴스 + 연관 뉴스로 배치합니다.
   - 연관 뉴스는 원형 노드로 표시되며, 노드를 누르면 그 뉴스가 맵 중심으로 이동합니다.
   - 연관 뉴스 이미지는 `thumbnail_url` → 기존 캐시 이미지 → 프론트 fallback 이미지 순서로 결정하고,
     이미지 로드가 실패하면 톤 배경 + 아이콘으로 대체합니다.
   - `GET /api/v1/news/{news_id}/graph`, `GET /api/v1/news/{news_id}/related`를 쓰는
     `fetchAndCacheNewsMap()`이 `apiAdapter.ts`에 있지만 **아직 화면에서 호출하지 않습니다.**

4. 뉴스 상세
   - `GET /api/v1/news/{news_id}/source`를 호출해 원문 출처 정보를 가져옵니다.
   - 백엔드가 `original_body`를 반환하면 상세 본문에 저장해 기존 mock 본문 대신 표시합니다.
   - 원문 링크는 본문과 분리된 `원문 링크` 영역에 표시됩니다.
   - 상세 화면의 대표 이미지는 검색/연관 뉴스 응답에서 캐시한 백엔드 이미지 URL을 그대로 사용합니다.

5. 리포트
   - `POST /api/v1/reports`로 리포트를 생성합니다.
   - `GET /api/v1/reports/{report_id}`로 리포트 상세를 조회합니다.
   - `POST /api/v1/strategies`, `GET /api/v1/strategies/{strategy_id}`로 투자 전략 정보를 가져옵니다.
   - 리포트/전략 API 호출이 실패하거나 백엔드가 `(AI 분석 준비 중)` fallback 응답을 반환하면 프론트의 mock 리포트로 대체합니다.

## 화면 컨트롤

하단에는 공통 네비게이션 버튼이 고정으로 표시됩니다.

- 뒤로가기
- 리포트
- 검색

뉴스맵 화면의 별도 floating 리포트 버튼은 사용하지 않으며, 리포트 이동은 하단 네비게이션 버튼 또는 뉴스 상세 화면의 `리포트 보기` 버튼을 통해 수행합니다.

그 밖에:

- 좌측 상단 버튼으로 **라이트/다크 테마**를 전환합니다. 선택은 `localStorage`(`econmind.theme`)에
  저장되고, 저장된 값이 없으면 OS 설정(`prefers-color-scheme`)을 따릅니다.
- API 실패 알림은 화면 좌측 하단 토스트로 표시되며 6초 뒤 자동으로 사라집니다.
  (이전에는 검색 결과 화면에서만 보였습니다.)

## 프로젝트 구조

```text
src/
  App.tsx                 화면 전환, 사용자 액션, 화면 단위 컴포넌트
  main.tsx                React 엔트리 포인트
  styles.css              전체 스타일 (색상은 전부 design/tokens.css 변수 참조)
  components/
    KeywordMap.tsx        검색어 + 추천 키워드 궤도 맵
    NewsMapCanvas.tsx     중심 뉴스 + 연관 뉴스 맵 (전체 화면 / 미니맵 공용)
    ui.tsx                테마 토글, 로딩 오버레이, 스켈레톤, 토스트, 이미지, 빈 상태
  design/
    tokens.css            디자인 토큰 (라이트/다크 색상, 간격, 타이포, 모션)
    useTheme.ts           테마 상태와 <html data-theme> 적용
  layout/
    mapLayout.ts          맵 노드 좌표 계산 (뷰포트별 프로필)
    useFieldScale.ts      컨테이너 크기 관찰 + 설계 공간 → 실제 크기 배율
  motion/
    presets.ts            애니메이션 variants·transition, reduced-motion 처리
  data/
    apiAdapter.ts         백엔드 /api/v1 응답을 프론트 데이터 형태로 변환
    mockData.ts           API 실패 시 사용하는 로컬 fallback 데이터와 타입 정의
```

## 맵 레이아웃

맵 노드의 좌표는 CSS가 아니라 `src/layout/mapLayout.ts`가 계산합니다.

- 설계 공간(고정 px) 안에서 극좌표로 위치를 잡고, 컨테이너 크기에 맞춰 `scale`만 곱합니다.
- 컨테이너 비율이 다른 자리마다 **프로필**을 둡니다.
  - 키워드 맵: 데스크톱 / 모바일
  - 뉴스맵: 데스크톱(좌우 부채꼴) / 미니맵·모바일(상하 부채꼴)
- 연관 뉴스 개수에 따라 노드 지름이 자동으로 줄어듭니다 (상한 6개).
- 노드 지름이 210px 미만이면 `상세` 버튼을 숨기고 노드 자체가 상세 이동 버튼이 됩니다.
  (미니맵·모바일은 원이 작아 버튼이 출처 텍스트를 덮습니다)

좌표를 CSS에서 분리하면서 브레이크포인트마다 노드 위치를 반복하던 274줄이 사라졌고,
중심 노드를 바꿀 때 위치 변화를 애니메이션으로 보간할 수 있게 됐습니다.

## 애니메이션

`src/motion/presets.ts`에 정의된 프리셋만 사용합니다. 주요 동작은 다음과 같습니다.

- 화면 전환: 5개 화면 cross-fade, 홈 검색창 ↔ 검색 결과 하단 스트립은 `layoutId`로 이어집니다.
- 맵: 중심에서 바깥으로 순차 등장(stagger), 노드 미세 부유, 연결선 draw-on,
  hover 시 확대 + 연결선 강조 + 나머지 노드 디밍, 중심 교체 시 재배치.
- 리포트: 종목 카드 순차 등장, 차트 막대 0 → 값.
- 로딩: 전역 오버레이 + 맵 자리 스켈레톤, 단계별 문구 표시.

`prefers-reduced-motion: reduce`가 설정된 환경에서는 반복 애니메이션이 꺼지고
최종 상태만 렌더링됩니다.

## mock 데이터

프론트의 fallback mock 데이터는 `src/data/mockData.ts`에 있습니다.

현재 앱은 백엔드 API 호출을 우선 사용합니다. 단, 다음 상황에서는 프론트 mock 데이터가 화면에 보일 수 있습니다.

- 백엔드 서버가 실행 중이 아닌 경우
- 백엔드 CORS 설정에 현재 프론트 포트가 빠진 경우
- API 요청이 실패한 경우
- 아직 API 응답을 받기 전 초기 렌더링 상태
- 리포트/전략 API가 백엔드 fallback 문구를 반환한 경우
- 백엔드가 `thumbnail_url`을 비워 반환한 경우 해당 카드 이미지만 프론트 fallback 이미지로 대체됩니다.

> 추천 키워드 API가 실패하면 키워드 맵은 로컬 fallback 키워드로 채워지고 토스트로 알립니다.
> (이전에는 실패를 내부에서 삼켜 검색어 1개짜리 맵이 그려졌습니다.)

백엔드 mock 뉴스 JSON은 프론트 저장소가 아니라 백엔드 저장소의 `fixtures/news_mock.json`에 있습니다.

## 빌드

타입 검사와 프로덕션 빌드를 함께 실행합니다.

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성됩니다.

## 빌드 결과 미리보기

```bash
npm run preview
```

## 컨테이너로 실행

이 저장소의 compose 는 **프론트 + mock API** 2개 서비스로 UI 를 확인하는 용도다.
전체 스택(진짜 백엔드 · Mongo · NATS · Redis)은 `capstone-deploy` 저장소의 compose 를 쓸 것.

```bash
docker compose up --build
# → http://localhost:8080   (mock API 가 /api/v1 응답을 준다)
```

프론트만 띄우려면 서비스를 지정한다.

```bash
docker compose up --build frontend
```

**백엔드가 없어도 컨테이너는 정상 기동하고 5화면이 끝까지 동작한다.**
`/api/*` 요청은 502 가 되고, 프론트가 로컬 fallback 데이터로 대체해 그린다.

진짜 백엔드를 호스트에서 돌리는 중이라면 `docker-compose.yaml` 의 `BACKEND_ORIGIN` 을
`host.docker.internal:8000` 으로 바꾼다.

compose 없이 직접 빌드·실행할 수도 있다.

```bash
docker build --build-arg VITE_API_BASE="" -t econmind-frontend:dev .
docker run --rm -p 8080:80 -e BACKEND_ORIGIN=host.docker.internal:8000 econmind-frontend:dev
```

## mock API (`mock-api/`)

프론트 UI 작업용 더미 API 다. `capstone-backend` 의 `/api/v1` 응답 스키마
(`app/schemas.py`)를 그대로 흉내 내며, **표준 라이브러리만 쓴다** — 의존성 설치가 없다.

> 실제 백엔드에도 mock 모드(`USE_MOCK_NEWS=true`)가 있지만 `google-genai`,
> `anthropic`, `trafilatura`, `lxml` 등을 설치해야 해서 프론트만 만질 때는 과하다.
> **실제 API 동작을 검증하려면 이 서버가 아니라 진짜 백엔드를 써야 한다.**

제공하는 엔드포인트

| 엔드포인트 | 비고 |
|---|---|
| `GET /health` | |
| `GET /api/v1/keywords/recommended` | 한국어 키워드 10종 |
| `GET /api/v1/news/search` | 뉴스 10건. 검색어가 1건만 걸리면 같은 topic 기사로 채운다 |
| `GET /api/v1/news/{id}/source` | 원문 본문 포함 |
| `GET /api/v1/news/{id}/graph`, `/related` | 프론트가 아직 호출하지 않지만 미리 준비 |
| `POST /api/v1/reports` → `GET /api/v1/reports/{id}` | |
| `POST /api/v1/strategies` → `GET /api/v1/strategies/{id}` | |
| `GET /api/v1/thumbnails/{tone}-{id}.svg` | 썸네일을 SVG 로 직접 생성 |

썸네일을 직접 만들기 때문에 **외부 이미지 호스트에 의존하지 않는다.** 폐쇄망에서도
화면이 그대로 나온다.

`npm run dev` 로 프론트를 돌리면서 mock 만 붙일 수도 있다.

```bash
docker compose up -d econmind-api        # 또는: python3 mock-api/server.py
VITE_API_BASE=http://127.0.0.1:8000 npm run dev
```

### 주의

- 리포트·전략은 메모리에만 저장된다. 컨테이너를 내리면 사라진다.
- 응답 본문에 `AI 분석 준비 중`, `생성하지 못했습니다`, `기본 포트폴리오 전략` 이
  들어가면 프론트(`hasBackendFallbackText`)가 응답을 버리고 자체 mock 리포트로
  갈아탄다. mock 데이터를 고칠 때 이 표현을 쓰지 말 것.

### 컨테이너 헬스체크

- `GET /healthz` — 프론트 컨테이너 자체의 생존 확인 (nginx 가 직접 200 응답)
- `GET /health` — 백엔드로 프록시된다. 백엔드가 없으면 502 이므로 프론트 헬스체크로 쓰면 안 된다

### nginx 프록시 동작

`nginx.conf` 는 `proxy_pass` 에 호스트명을 리터럴로 쓰지 않고 `$econmind_backend`
변수를 거친다. 리터럴로 쓰면 nginx 가 **기동 시점에** DNS 를 해석하고 실패 시
`host not found in upstream "econmind-api"` 로 아예 뜨지 않아, 백엔드 없이
프론트만 띄우는 것이 불가능하기 때문이다.

변수와 `resolver` 는 `docker-entrypoint.d/10-backend-resolver.sh` 가 컨테이너 기동 시
`/etc/nginx/conf.d/00-backend.conf` 로 생성한다. `resolver` 주소는 컨테이너의
`/etc/resolv.conf` 에서 읽고, 없으면 Docker 내장 DNS(`127.0.0.11`)로 떨어진다.

## 사용 API

프론트에서 사용하는 주요 API는 다음과 같습니다.

- `GET /api/v1/keywords/recommended`
- `GET /api/v1/news/search`
- `GET /api/v1/news/{news_id}/source`
- `POST /api/v1/reports`
- `GET /api/v1/reports/{report_id}`
- `POST /api/v1/strategies`
- `GET /api/v1/strategies/{strategy_id}`

`apiAdapter.ts`에 어댑터는 있으나 아직 화면에서 호출하지 않는 API:

- `GET /api/v1/news/{news_id}/graph`
- `GET /api/v1/news/{news_id}/related`

## 주의 사항

- 프론트와 백엔드를 다른 포트에서 실행할 경우, 백엔드 CORS 허용 목록에 프론트 Origin이 포함되어 있어야 합니다.
- 종목 등락 색상은 **한국 증시 관례**를 따릅니다 — 상승 = 빨강, 하락 = 파랑.
  서구권 관례(상승 = 초록)와 반대이므로 `design/tokens.css`의 `--up` / `--down` 수정 시 주의하세요.
- 본문 폰트로 Pretendard를 CDN에서 불러옵니다. 오프라인 환경에서는 시스템 폰트로 대체됩니다.
- `VITE_API_BASE`를 변경했다면 개발 서버를 재시작해야 반영됩니다.
- `dist/`와 `node_modules/`는 Git에 올리지 않습니다.

## 라이선스

본 프로젝트는 단국대학교 캡스톤 디자인 과목 학습 목적으로 작성되었습니다.
