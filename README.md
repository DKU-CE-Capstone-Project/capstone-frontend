# Capstone Frontend

실시간 뉴스 기반 멀티 에이전트 투자 판단 지원 시스템의 프론트엔드입니다.

React, TypeScript, Vite 기반으로 구현되어 있습니다. 이 README는 **2026-10-01 로컬 `article-api` 브랜치**의 화면·데이터 처리를 설명합니다. 같은 날 2차 작업 시작 커밋은 `80b945abac761906a0739a7db3a2a58ac7b0f802`이며 미커밋 변경 없이 시작했습니다. 결과 커밋은 정본 `docs/99-verification.md`의 2026-10-01 기록에 남깁니다. 프로젝트 정본은 [econmind-docs](https://github.com/DKU-CE-Capstone-Project/econmind-docs)이며 기존 뉴스 세션 경로의 2026-09-21 병합 기록과 이번 로컬 뉴스맵 변경을 구분합니다. 백엔드 `article-api`의 `/api/v1`에 연결하며 [API 명세](https://github.com/DKU-CE-Capstone-Project/econmind-docs/blob/main/docs/07-api-spec.md)의 날짜별 계약을 참고합니다. 원격 반영·운영 배포는 수행하지 않았습니다.

## 작업 브랜치의 뉴스 경로

**GDELT의 반복적인 HTTP 429 오류 때문에 기본 공급원을 NCP NAVER API HUB로 변경했다. 해외 뉴스는 검토 예정이다.**
검색은 20건을 요청하고, NAVER 뉴스 URL이 있으며 정치·사회 제외 조건을 통과한 결과만 표시한다. 필터 결과가 적어도 샘플 기사로 채우지 않는다. 검색 실패와 결과 없음은 별도로 안내한다.

- 키워드맵: 입력어와 백엔드의 고정 추천 키워드를 표시한다. 뉴스 검색은 키워드 노드를 열 때 시작한다.
- 뉴스맵: NAVER 검색 결과의 첫 기사를 중심으로 두고 `/related?tier=FREE`에서 선정된 주변 기사를 서버 순서대로 표시한다. FREE 상한은 주변 최대 3건이며 중심까지 합치면 최대 4건이다. 반복 보도는 표시에서 제외하고 유용한 추가 정보를 제공하는 주변 대표만 표시한다.
- 뉴스 상세: 검색·연관 기사 응답의 **description을 우선 표시**하고 없으면 호환용 summary를 사용한다. 출처·발행 시각·원문 링크·썸네일도 해당 응답에서 읽는다. 본문 API를 추가 호출하지 않으며, 기사를 바꾸면 스크롤을 초기화한다.
- 리포트 보기: 뉴스맵에서는 중심 기사, 상세에서는 **선택한 기사**의 ID로 리포트를 요청한다. 이때 백엔드가 NAVER URL에서 Diffbot으로 본문 1건을 추출한다.
- QR 코드 이미지는 백엔드에서 제외한다. 원문 링크는 별도 영역에 제공한다.
- 본문 추출·리포트·전략 실패와 AI fallback 응답은 오류로 표시하며 샘플 리포트로 바꾸지 않는다.

API 비밀키는 백엔드에만 둔다. Gemini 3.5 Flash-Lite / Flex 설정 역시 백엔드의 책임이다. Flex 요청은 오래 걸릴 수 있어 Nginx의 API 대기 시간을 1500초로 맞췄다. MongoDB 실제 준비 상태는 `/ready`로 프록시한다.

검색·연관 기사 응답을 같은 카드 변환기로 처리하고 서버의 `keywords`·`categories`를 상세 태그에 표시한다. 검색 캐시에 없던 연관 기사도 `/related` 응답만으로 상세 정보를 채운다. 구버전 응답에서 필드가 빠졌을 때만 기존 캐시를 재사용하며, 명시적인 빈 태그 배열은 그대로 반영한다. 기사 태그 표시와 키워드맵 연관어 선정은 별개다. 뉴스 기반 연관 키워드, 다단계 확장, 새 프론트 프로토타입 포팅은 포함하지 않는다.

## 대표 기사와 추가 후보 확장 표시 (2026-10-02)

- `SameStoryPanel`과 묶음 배지/펼치기/전용 상세 이동, App 상태·props, 어댑터의 묶음 캐시·타입, mock/fixture, 전용 CSS와 오른쪽 목록 열을 제거했다. 일반 기사 캐시와 메타데이터, 상세·주변 클릭/중심 이동·원문·검색·리포트·유료 프리뷰를 유지한다.
- 서버는 `same_story`·`same_story_total`·`center_same_story`·`center_same_story_total`을 제거했다. 과거 응답이나 캐시에 이 필드가 남아 있어도 화면은 읽지 않고 정상 기사 데이터를 사용한다. 부족한 수를 `/graph`·검색 결과·샘플로 채우거나 재정렬하지 않는다.
- [어댑터](src/data/apiAdapter.ts)는 `expand=false`의 최초 결과를 먼저 그리고 `expandable`이면 `expand=true`를 요청한다. 기존 노드를 유지한 추가 검색 중 표시, `partial`/`insufficient`/오류 구분, 늦은 응답 차단을 유지한다. [상태 안내](src/components/NewsMapStatus.tsx)에는 묶음 건수나 관련 문구가 없다.

로컬 검증: `npm test` **20개**, `npx tsc --noEmit -p tsconfig.json`, `npm run build` 성공. 구버전 묶음 필드 무시/일반 상세 메타데이터 유지, 노드/상세 동작에서 배지 없음, 0·1·2개·확장/부분/오류/늦은 응답을 확인한다. 실제 로컬 프론트 `http://127.0.0.1:5194`와 현재 서비스 API fixture 서버 `http://127.0.0.1:9034`에서 검색→뉴스맵→주변 상세→중심 이동을 조작하고 데스크톱 1440×900/모바일 375×812 레이아웃·콘솔 오류 0건을 확인했다. 환율/해운/사이버보안/비만치료제의 저장 입력과 기존 벡터를 사용하며, 이미지/검색/분류는 로컬 fixture다. 외부 API·DB·리포트 생성은 실호출하지 않았다.

현재 테스트용 UI fixture는 `python3 scripts/serve-news-map-fixtures.py`로 9031에 실행할 수 있다. `검증대표`는 대표 3개, `검증0/1/2`·`검증확장`·`검증부분`·`검증오류`는 기존 상태 검사용 가상 기사다. 아래 2026-10-01 및 2026-09-30 검증/구현 절은 당시 기록이며 묶음 기능은 위 변경으로 제거됐다.

## 반복 보도 개선과 적은 결과 안내 (2026-10-01 1차)

뉴스맵은 백엔드가 명확한 중복 → 최소 연관도 → 같은 사건의 반복 정보 → MMR 다양성 → 요금제 limit 순으로 선정한 결과를 표시합니다. **점수는 중심과의 연관도이며 최종 순서는 점수 내림차순과 다를 수 있습니다.** [데이터 어댑터](src/data/apiAdapter.ts)는 이미 서버 배열 순서·이전 중심 응답 차단·캐시 없는 상세 메타데이터 보존·보충 없음 계약을 지켜 이번에는 수정하지 않았습니다. `/graph`·최초 검색 결과·샘플 기사로 부족한 개수를 채우지 않습니다.

[상태 안내](src/components/NewsMapStatus.tsx)는 0개에는 기준을 통과한 기사가 없다는 설명, 1·2개에는 선정 개수와 관련성/반복 보도 기준 안내를 표시합니다. 로딩 중에는 적은 결과 안내를 숨깁니다. 요청 실패는 정상 빈 결과와 구분하며 뉴스맵 오류를 토스트와 별도로 유지해 토스트를 닫거나 자동 소멸해도 오류가 남습니다. 새 중심·키워드를 열 때 오류와 이전 주변 결과를 비우고 늦은 응답을 차단합니다. 카드·레이아웃·최초 중심 선정은 유지했습니다. 추가 검색·뉴스맵 임베딩은 백엔드 책임이며 기사 쌍별 생성 API나 본문 요청은 프론트에서 발생하지 않습니다.

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
npm ci
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

2. 키워드맵
   - 검색어와 `GET /api/v1/keywords/recommended`의 고정 추천어를 중복 제거해 표시합니다.
   - 이 화면을 여는 단계에서는 뉴스 검색이나 본문 추출을 하지 않습니다.

3. 뉴스맵
   - 키워드 노드를 열 때 `GET /api/v1/news/search`로 최대 20건을 요청하고, 필터 후 남은 첫 결과를 중심으로 둡니다.
   - 중심 뉴스가 정해지면 `GET /api/v1/news/{news_id}/related?limit=6&tier=FREE`로
     백엔드가 평가·필터·정렬한 기사를 가져옵니다. 검색 결과 캐시는 후보 보관용이며
     평가를 통과하기 전에는 연관 기사로 표시하지 않습니다.
   - 서버 순서를 유지하며 `distance`로 다시 정렬하거나 `/graph`로 채우지 않습니다.
     레이아웃은 최대 6개를 지원하지만 현재 FREE 요청은 **주변 최대 3개**를 받습니다.
     기준을 통과한 기사가 2개면 2개만 표시합니다. `tier=FREE`는 프론트에 명시돼 있으며
     실제 구독 상태 확인·유료 전환 기능은 아직 없습니다.
   - 중심 변경·요청 실패 시 이전 연관 목록을 비웁니다. 실패하면 오류를 표시하고
     최초 검색 결과로 대체하지 않습니다. 이전 중심의 늦은 응답도 새 목록을 덮어쓰지 않습니다.
   - 연관 뉴스는 원형 노드로 표시되며, **노드를 누르면 그 뉴스가 맵 중심으로 이동하고
     그 뉴스의 이웃을 다시 받아옵니다.** 중심은 먼저 바꿔 재배치 애니메이션이 바로 돌고,
     이웃은 뒤이어 채워집니다. 그동안 맵 위에 작은 상태 표시만 나옵니다.
   - 노드 좌표는 `src/layout/mapLayout.ts`가 극좌표로 계산하고, 연결선은 실제 노드
     좌표에서 생성합니다.
   - 검색이 실패하거나 표시할 기사가 없으면 정적 목 데이터를 대신 보여주지 않고
     빈 상태와 오류 메시지를 냅니다.
   - 연관 뉴스 이미지는 `thumbnail_url` → 기존 캐시 이미지 → 프론트 fallback 이미지 순서로 결정하고,
     이미지 로드가 실패하면 톤 배경 + 아이콘으로 대체합니다.

4. 뉴스 상세
   - 검색·연관 기사 응답의 `description`과 `source_url`을 바로 표시합니다. 출처·발행 시각·기사 키워드·카테고리도 같은 응답을 사용합니다.
   - 상세 진입에서는 전체 본문을 요청하거나 Diffbot을 호출하지 않습니다.
   - 원문 링크는 본문과 분리된 `원문 링크` 영역에 표시됩니다.
   - 상세 화면의 대표 이미지는 검색/연관 뉴스 응답에서 캐시한 백엔드 이미지 URL을 그대로 사용합니다.

5. 리포트
   - `POST /api/v1/reports`로 리포트를 생성합니다.
   - `GET /api/v1/reports/{report_id}`로 리포트 상세를 조회합니다.
   - `POST /api/v1/strategies`, `GET /api/v1/strategies/{strategy_id}`로 투자 전략 정보를 가져옵니다.
   - `리포트 보기`를 다시 누르면 프론트는 요청을 다시 보냅니다. 백엔드의 동일 기사·연관 기사 조합 리포트 재사용은 프로세스 메모리 안에서만 동작하고, 전략 생성은 매번 새로 요청합니다.
   - 리포트/전략 API 호출 실패 또는 `(AI 분석 준비 중)` 응답은 오류로 표시합니다.

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
    mockData.ts           초기 프로토타입·추천 키워드·이미지 fallback과 타입 정의
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

추천 키워드·초기 프로토타입 화면·이미지가 없는 카드에는 로컬 기본 데이터가 남아 있습니다. 실제 뉴스 검색 실패/빈 결과와 리포트 실패에는 샘플 뉴스나 샘플 리포트를 대신 표시하지 않습니다.

> 추천 키워드 API가 실패하면 키워드 맵은 로컬 fallback 키워드로 채워지고 토스트로 알립니다.
> (이전에는 실패를 내부에서 삼켜 검색어 1개짜리 맵이 그려졌습니다.)

백엔드 mock 뉴스 JSON은 프론트 저장소가 아니라 백엔드 저장소의 `fixtures/news_mock.json`에 있습니다.

## 빌드

타입 검사와 프로덕션 빌드를 함께 실행합니다.

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성됩니다. 서버 배포는 같은 도메인의 API를 사용하므로 다음처럼 빌드합니다.

```bash
VITE_API_BASE='' npm run build
docker build --platform linux/amd64 --build-arg VITE_API_BASE= -t econmind-frontend:release-20260918 .
```

2026-09-18 로컬 타입 검사·Vite 빌드와 amd64 Docker 빌드를 확인했습니다. 이는 당시 브랜치 빌드 기록이며 현재 운영 배포 결과를 뜻하지 않습니다. 날짜별 검증 범위는 정본 `docs/99-verification.md`를 참고합니다.

## 뉴스맵 과거 로컬 검증 (2026-10-01 2차)

```bash
npm test
npm run build
```

[테스트](scripts/test-news-map.mjs) **20개 통과**, TypeScript 타입 검사와 Vite 빌드(1,996 modules) 성공. 1차 14개에 더해 묶음 카드의 상세 정보 캐시·노드 수 비소비, `expand=false → expandable → expand=true` 흐름에서 기존 노드 유지, 다른 중심으로 바뀐 뒤 늦게 온 확장 응답 차단, 확장 실패 시 부분 결과 표시, 상태 안내 6가지 구분, 묶음 패널의 제목·출처·시각·상한 안내를 검사합니다. 훅을 쓰는 컴포넌트를 SSR로 검사하려고 테스트 번들은 React를 외부 모듈로 두고 `node_modules` 아래 임시 폴더에서 실행 후 삭제합니다.

2차 브라우저 확인: 실제 로컬 스택(NAVER·Gemini 실호출, 로컬 MongoDB)에서 "국제유가" 검색 → 뉴스맵(중심 반복 보도 4건 묶음) → 주변 기사로 중심 이동(같은 소식 5건 묶음) → 묶음 펼치기 → 묶인 기사 상세를 데스크톱 1440×900에서 조작했습니다. UI fixture로 추가 검색 중·확장 완료·부분 결과(확장 요청 실패)·모바일 375×812의 접힌/펼친 패널을 확인했습니다. 캡처는 프로젝트 루트 `artifacts/news-map-grouping-20261001/`(저장소 밖)에 있습니다. 실뉴스 선정 품질 평가는 정본 `docs/99-verification.md`를 따르며 앱 Docker 이미지·운영 배포는 검증하지 않았습니다.

1차 기록: 의도적으로 점수 내림차순과 다른 서버 MMR 순서, 0·1·2개 정확한 개수, 그래프 보충 없음, 늦은 응답/실패 처리, 캐시 없는 상세 정보, 서버 태그 보존을 확인했습니다. 실제 상태 컴포넌트 SSR과 데스크톱·모바일·작은 화면의 노드 좌표 검사도 포함합니다.

로컬 fixture API와 실제 Vite 화면을 브라우저에서 조작해 0·1·2개 결과, 주변 기사 상세의 description·출처·발행 시각·링크·키워드·카테고리, 토스트를 닫은 뒤의 오류 안내를 확인했습니다. fixture는 직접 작성한 가상 기사이며 **실제 백엔드/외부 API/한국어 뉴스의 의미 품질 검증이 아닙니다**. 브라우저 조작은 데스크톱에서 실행했고 모바일은 좌표/SSR 검사 범위입니다. 앱 Docker 이미지·운영 배포는 이번에 검증하지 않았습니다.

재현할 때 별도 터미널에서 아래 두 프로세스를 실행하고 추천어 `검증0`, `검증1`, `검증2`, `검증오류`, `검증묶음`, `검증확장`(확장 응답 2초 지연), `검증부분`(확장 요청 503)의 키워드 노드를 엽니다. 로컬 loopback fixture는 외부 요청을 하지 않습니다.

```bash
python3 scripts/serve-news-map-fixtures.py
VITE_API_BASE=http://127.0.0.1:9031 npm run dev -- --host 127.0.0.1 --port 5191 --strictPort
```

## 뉴스맵 과거 검증 기록 (2026-09-30)

```bash
npm test
npm run build
```

[실제 데이터 어댑터 테스트](scripts/test-news-map.mjs) 10개와 TypeScript 타입 검사·Vite 빌드를 통과했습니다. HTTP 응답을 mock해 서버 순서 유지, `/graph` 보충 없음, 빈 결과 유지, 실패 시 목록 제거·예외 전달, 이전 중심 응답 차단을 확인합니다. 공통 카드 후속 변경에서는 캐시 없는 연관 기사 상세, 서버 태그 반영·빈 배열 갱신, 구버전 응답 호환, source 변환과 빈 description의 summary 대체도 확인합니다. App의 오류·태그 표시 코드를 확인했으며 실제 브라우저 화면 조작·Gemini 의미적 선정 품질·이번 Docker 이미지 빌드·운영 배포는 검증하지 않았습니다.

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
docker run --rm -p 127.0.0.1:8080:80 -e BACKEND_ORIGIN=host.docker.internal:8000 econmind-frontend:dev
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
| `GET /api/v1/news/{id}/graph`, `/related` | 같은 topic 기사를 이웃으로 돌려줍니다 |
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

두 실행 방식 모두 호스트에서는 127.0.0.1:8000으로만 접근한다. Compose 안의 mock API는 프론트엔드 컨테이너와 통신하도록 컨테이너 내부에서 수신한다.

### 주의

- 리포트·전략은 메모리에만 저장된다. 컨테이너를 내리면 사라진다.
- 응답 본문에 `AI 분석 준비 중`, `생성하지 못했습니다`, `기본 포트폴리오 전략`이
  들어가면 프론트(`hasBackendFallbackText`)가 성공 응답으로 표시하지 않고 오류를 냅니다.
  mock 데이터를 고칠 때 이 표현을 쓰지 말 것.

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

현재 화면에서 호출하는 API는 다음과 같습니다.

- `GET /api/v1/keywords/recommended`
- `GET /api/v1/news/search`
- `GET /api/v1/news/{news_id}/related?limit=6&tier=FREE`
- `POST /api/v1/reports`
- `GET /api/v1/reports/{report_id}`
- `POST /api/v1/strategies`
- `GET /api/v1/strategies/{strategy_id}`

`/graph`는 현재 화면에서 호출하지 않으며 `/source` 호출 함수는 어댑터에 남아 있지만 상세 진입은 캐시 description을 사용합니다. 프록시된 `/ready`는 운영 점검 경로이며 화면 요청에는 포함되지 않습니다. 별도 mock API의 topic 기반 이웃 응답은 실제 백엔드 임베딩 선정 구현과 다릅니다.

## 주의 사항

- 프론트와 백엔드를 다른 포트에서 실행할 경우, 백엔드 CORS 허용 목록에 프론트 Origin이 포함되어 있어야 합니다.
- 종목 등락 색상은 **한국 증시 관례**를 따릅니다 — 상승 = 빨강, 하락 = 파랑.
  서구권 관례(상승 = 초록)와 반대이므로 `design/tokens.css`의 `--up` / `--down` 수정 시 주의하세요.
- 본문 폰트로 Pretendard를 CDN에서 불러옵니다. 오프라인 환경에서는 시스템 폰트로 대체됩니다.
- `VITE_API_BASE`를 변경했다면 개발 서버를 재시작해야 반영됩니다.
- `dist/`와 `node_modules/`는 Git에 올리지 않습니다.

## 라이선스

본 프로젝트는 단국대학교 캡스톤 디자인 과목 학습 목적으로 작성되었습니다.
