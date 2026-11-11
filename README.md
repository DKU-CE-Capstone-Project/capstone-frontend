# EconMind Frontend

React 19 · TypeScript · Vite 기반 뉴스맵 프론트엔드입니다. 프로젝트 문서 정본은 [econmind-docs](https://github.com/DKU-CE-Capstone-Project/econmind-docs)입니다.

<a id="newsmap-next-issue-20261108"></a>

## 뉴스맵에서 다른 이슈 보기 (2026-11-08)

상세·리포트 패널을 닫은 뉴스맵에서 `next_issue`가 있거나 `can_find_next_issue`가 `true`이면 상단에 **다른 이슈 보기**를 표시합니다. 이미 확인한 이슈의 제목을 보여주고, 제목이 없으면 같은 검색어에서 다른 주제를 찾을 수 있다고 안내합니다. 연관 기사 4건인 맵에도 버튼이 표시되며, 별도 영역에 배치해 기사 카드를 가리지 않습니다. [화면 구현](src/components/NewsMapExplorer.tsx) · [PR #23](https://github.com/DKU-CE-Capstone-Project/capstone-frontend/pull/23)

- 버튼을 누를 때만 `POST /api/v2/maps/{map_id}/next-issue`를 보냅니다. 새 맵을 받으면 연관 기사가 0건이어도 새 중심을 표시합니다. 같은 맵을 받으면 현재 선택을 유지하고 ‘같은 검색어에서 다른 이슈를 찾지 못했어요.’를 표시합니다. [요청 처리](src/data/newsMapService.ts)
- **이전 뉴스맵**은 `previous_issue_map_id`로 GET 요청을 보내 앞선 맵의 선택과 연결된 결과를 복원합니다. 화면마다 조작 참조를 따로 두어 이전 화면의 전환 애니메이션이 끝난 뒤에도 새 맵의 버튼을 누를 수 있습니다. [화면 전환](src/App.tsx) · [PR #24](https://github.com/DKU-CE-Capstone-Project/capstone-frontend/pull/24)

GCP에 최종 프론트 `f6ac1b3`를 반영했습니다. 운영 브라우저에서 ‘반도체’의 연관 기사 **1건 → 4건 → 0건**으로 연속 전환하고 이전 선택을 복원했습니다. 4건 맵에서 보낸 전환 요청은 HTTP 200이었고 모니터링 수집 DB에서도 확인했습니다. 배포 기준의 `npm test` 77건과 `npm run build`를 통과했고, Chrome fixture에서 4건 맵의 연속 전환과 이전 맵 조회를 확인했습니다. [최종 main CI](https://github.com/DKU-CE-Capstone-Project/capstone-frontend/actions/runs/42477476014) · [정본 배포·모니터링 기록](https://github.com/DKU-CE-Capstone-Project/econmind-docs/blob/main/docs/99-verification.md#newsmap-next-issue-20261108)

## WP9·WP11 리포트 근거 연결 (2026-11-07)

[PR #21](https://github.com/DKU-CE-Capstone-Project/capstone-frontend/pull/21)을 `main` **`918891a`**에 병합했습니다. 기사 근거를 표시하는 화면 E·F·H를 구현했습니다.

- **WP9 · 인용 칩:** 종목 영향의 `evidence_news_ids`를 실제 사용 근거와 대조해 선택 기사 번호를 표시합니다. 칩을 누르면 **분석 근거와 제한**의 해당 기사를 강조하고 포커스합니다. 근거나 번호를 확인할 수 없는 인용은 확인 불가로 표시합니다.
- **WP11 · 근거 사슬:** 전략 항목과 이름·종목 코드가 같은 리포트 종목 영향을 연결하고, 해당 영향의 사용 기사 칩을 표시합니다. 일치하는 영향이 없으면 연결할 수 없다고 표시합니다. 이는 별도 영향 ID를 이용한 인과 검증이 아닙니다.
- **WP11 · 기사 배지:** 완성된 현재 리포트의 본문 사용·실패 결과를 뉴스맵 노드에 표시합니다. 닫힌 패널도 GET으로 결과를 복원하고, 선택이 바뀐 뒤 늦게 도착한 결과는 반영하지 않습니다.
- **전략 요약 카드:** 전략이 있으면 요약을 표시합니다. `중립적 관점`은 전략의 `risk_level=medium`에 대응하는 화면 라벨입니다. 전략 생성이 실패하면 리포트를 유지하고 안내합니다. 관련 백엔드 수정은 [PR #34](https://github.com/DKU-CE-Capstone-Project/capstone-backend/pull/34)입니다.

`npm test` **73 passed**, `npm run build`의 타입 검사·빌드와 로컬 Compose 포트 검사가 통과했고, PR과 병합 후 `main` CI도 통과했습니다. 로컬 브라우저에서는 실제 기사 5건의 저장 리포트 1건과 새로 생성된 전략의 표시를 확인했습니다. 이 사례는 소표본이며 이번 작업에서 GCP 배포는 수행하지 않았습니다. 전체 완료 범위와 검증 기록은 [정본 문서 PR #28](https://github.com/DKU-CE-Capstone-Project/econmind-docs/pull/28)에 정리했습니다.

## 키워드맵 실데이터 연결 및 화면 정렬 개선 (2026-10-25)

초기 키워드 맵(`02 키워드 맵`)을 백엔드 실시간 뉴스 추출 API에 연결하고, 키워드맵·뉴스맵 두 마인드맵 화면의 배치 및 정렬을 개선했습니다(`feat/keyword-map-gemini` → `main`).

- **키워드맵 API 연결 (`src/data/newsMapService.ts`, `src/App.tsx`):** 기본/실제 API 모드에서 `fetchKeywordMap(query)`가 `GET /api/v1/keywords/map?q=...`를 호출하고 `KeywordMapNode`(`center` / `issue` / `entity`, `article_count`, `search_query`, `center_news_id`, `news_ids`)를 보존합니다. 주변 노드 클릭 시 표시 라벨 대신 서버가 구성한 복합 검색어(`node.search_query`)로 뉴스맵을 요청합니다. `VITE_NEWS_MAP_SOURCE=mock`은 오프라인 브라우저 fixture를 유지하며, 홈 추천 키워드는 설계대로 고정 목록을 유지합니다. HTTP UI fixture(`mock-api/v2.py`)에도 `/api/v1/keywords/map` 합성 응답을 추가했습니다.
- **키워드맵 2궤도 배치 및 잘림·가림 수정 (`src/layout/mapLayout.ts`, `src/components/KeywordMap.tsx`, `src/styles.css`):** 서버 노드의 `kind === 'issue'`는 안쪽 1궤도(이슈가 4개 미만이어도 유지), `kind === 'entity'`는 바깥 2궤도에 배치합니다. 상단 `.result-search-strip`(`z-index: var(--z-header)`) 및 하단 내비게이션과 노드가 겹치지 않도록 `.results-view` 상·하단 여백(`76px` / `168px`, 모바일 `72px` / `164px`)과 `.orbit-field` `overflow: visible`을 적용하고, 긴 한국어 구문이 원 밖으로 잘리지 않도록 궤도·노드 크기 비율, 글자 수 기반 동적 폰트 축소(`adjustedKeywordFont`), `overflow-wrap: break-word`, 전체 구문 툴팁(`title`)을 반영했습니다.
- **뉴스 기사 마인드맵 정중앙 정렬 (`src/components/NewsMapExplorer.tsx`):** 기존 우측 프리뷰 폭 오프셋(`PREVIEW_GUTTER = 196` → `1280×832` 기준 `(542, 420)`)을 제거하고 기본 카메라 원점을 뷰포트 정중앙 `(W / 2, H / 2)`(`(640, 416)`)으로 정렬했습니다. 오른쪽 상세 시트(`detailCx = (W - 520) / 2`)나 리포트 시트(`reportCx = (W - 720) / 2`)가 열릴 때 남은 좌측 영역 가운데로 이동하는 동작과 휠 확대·미니맵 뷰포트 계산은 그대로 유지합니다.
- **로컬 검증:** `npm test` **67 passed, 0 failed**, `npm run build`(`tsc --noEmit && vite build`) 성공, `python3 -m py_compile scripts/serve-v2-fixtures.py mock-api/v2.py` 및 `docker compose config --format json | python3 scripts/check-local-compose.py` 통과.

아래 2026-10-11 절은 최초 v2 구현·배포 당시 기록입니다.

## 최초 v2 구현 배경 (2026-10-11)

2026-10-11 `origin/main` (`4f0bea6`)에서 시작한 로컬 `codex/newsmap-v2-20261011` 구현입니다. 새 뉴스맵 UI는 `origin/newsmap-prototype-mock`의 화면·트리 배치를 재사용하고, 탐색·선택·리포트를 정본 [API v2 설계](https://github.com/DKU-CE-Capstone-Project/econmind-docs/blob/main/docs/10-newsmap-prototype-api-design.md)에 연결했습니다. 이 문단은 구현 시작점이며 당시 운영 상태는 아래 배포 확인을 따릅니다.

문서 동기화 때 확인한 범위는 기준 커밋 `e986b3f`와 당시 미커밋이던 `NewsMapExplorer.tsx` 변경입니다. 네 저장소의 구현·검증·보류 범위는 정본 `docs/14-newsmap-v2-implementation.md`에 정리했습니다. 문서 동기화에서 화면 로직을 추가 변경하지 않았습니다.

## GCP 배포 확인 (2026-10-11)

[PR #16](https://github.com/DKU-CE-Capstone-Project/capstone-frontend/pull/16)을 main `225c334`로 병합하고 [운영 서비스](https://econmind.duckdns.org)에 배포했다. 실제 브라우저에서 홈→키워드맵→국제유가 실뉴스 주변 4/4→FREE 1건 선택→리포트·전략 표시→새로고침 복원을 확인했다. 같은 API의 실제 생성·DB 저장도 검증했다. 운영은 서버 capability에 따른 무료 1건이며 홈 추천·키워드맵 mock과 주변 기사 부족 개선 보류를 유지한다. [배포·검증 근거](https://github.com/DKU-CE-Capstone-Project/econmind-docs/blob/main/docs/99-verification.md#2026-10-11-newsmap-v2-gcp-배포). 위 브랜치 설명과 아래 로컬 검증은 각각 작성 당시의 기록이다.

## 현재 연결

- 홈 추천은 고정 목록입니다. 실제 API 모드에서 키워드맵은 `GET /api/v1/keywords/map`으로 구성합니다.
- 뉴스맵은 `POST /api/v2/maps`의 중심·최초 주변 목표 4건과 서버 선정 순서를 표시합니다. Space+클릭 또는 Shift+Enter로 가지 펼치기·재검색(하위 목표 3건)을 요청합니다. 중심 이동·휠·끌기·미니맵은 프론트 좌표만 바꿉니다. 현재 작업 트리는 휠 확대가 기존 상태 안내를 확대 배율 문구로 덮어쓰지 않게 합니다.
- 백엔드는 최초 허용 검색 결과를 중심으로 사용하며, 원래 검색어의 1~20 → 21~40 → 41~50 범위에서 필요한 만큼 후보를 확보합니다. 목표보다 적게 선정된 경우도 표시합니다. 같은 검색어에서 다른 중심을 보려면 [다른 이슈 보기](#newsmap-next-issue-20261108)를 사용합니다.
- 뉴스맵 캔버스에는 기사 카드와 카드에서 펼친 가지를 표시합니다. 프로토타입의 키워드 노드·키워드 점선·바깥 키워드 궤도·키워드맵 이동 동작은 제거했습니다. 기사 키워드는 상세 패널의 태그로 제공합니다.
- 서버의 `Session.capabilities`를 읽습니다. FREE는 선택 1건 교체·해제, PAID 프로토타입 설정은 최대 10건 추가·해제입니다. 클라이언트가 요청 본문에 티어를 보내지 않습니다. 로그인·결제 검증은 포함하지 않습니다.
- 기사 선택, 가지 펼치기, 초기화처럼 기존 맵의 변경을 요청할 때는 `expected_revision`을 붙입니다. 카드 연속 클릭을 직렬화하고 409 충돌은 최신 맵을 다시 읽은 뒤 오류를 표시합니다. 재검색 0건은 서버가 반환한 기존 가지·선택을 유지합니다. 부족·일시적인 부분 결과·외부 실패를 구분하며 샘플 기사로 채우지 않습니다.
- 리포트는 선택한 실제 `news_id`만 `POST /api/v2/report-jobs`에 보냅니다. 선택하지 않은 중심을 추가하지 않습니다. `Idempotency-Key`와 요청 UUID를 사용하며 네트워크/큐 접수 재시도에서 동일 입력·키를 유지합니다.
- 생성 단계와 처리·성공·실패 건수는 GET 작업 응답을 표시합니다. 임의 백분율·추정 진행률을 만들지 않습니다. 완료 후 맵 revision·활성 작업·결과 연결을 확인하고 리포트와 별도 전략을 읽습니다.
- 리포트 생성 진행 목록은 첫 화면부터 전체 단계를 보여 줍니다(2026-11-11). 서버는 작업 응답에 토론 사용 여부를 담지 않으므로 강세·약세 토론 경로(본문 추출 → 강세·약세 분석 → 중재 판정 → 근거 검증 → 결과 저장 → 전략 생성)로 시작하고, 직전 작업에서 본 경로를 `localStorage`의 `econmind.v2.report-track`에 기억합니다. 토론 없는 서버에서는 `analyzing`을 받은 뒤 기존 세 단계 표시로 바뀌고 다음 작업부터는 처음부터 세 단계입니다. 주장 수정과 토론 실패 뒤의 일반 분석은 서버가 알렸을 때만 단계에 넣습니다. 저장된 리포트를 재사용한 작업은 실행하지 않은 분석 단계를 ‘기존 결과 사용’으로 표시합니다.
- 성공 본문·실패 기사·coverage·본문 절단 여부·자동 검색 참고 자료·critic 검증 상태를 구분합니다. 전략 실패는 완성된 리포트를 유지하며 전략 행동과 주가 영향 방향을 서로 바꾸지 않습니다. 확인되지 않은 종목 코드·영향 방향도 그대로 표시합니다.
- 상세는 카드의 description·태그·원문 링크를 사용합니다. 탐색/상세에서 본문 추출을 요청하지 않습니다. 백테스트·성과 차트·연관도 상세·심화 리포트는 보류합니다.
- 뉴스 카드·상세·리포트 근거 썸네일은 API의 실제 `thumbnail_url`을 표시합니다. 사진 비율은 유지하면서 영역에 맞춰 자르고, URL이 없거나 로딩에 실패하면 이미지 없음 아이콘과 톤 배경을 표시합니다. 다른 기사의 사진으로 대체하지 않습니다.

## 세션과 복원

요청은 `credentials: include`와 HttpOnly `econmind_sid` 쿠키를 사용합니다. 같은 탭 `sessionStorage`의 `econmind.v2.navigation`에는 `{session_epoch, map_id}`만 저장합니다. 트리·리포트·세션 비밀 ID를 브라우저 저장소에 복사하지 않습니다. 기존 main의 v1 어댑터·세션 보안 구현은 보존했습니다.

새로고침은 GET 세션 → GET 기존 맵 → GET 기존 활성 작업/최종 결과 순서입니다. 새 생성 POST를 자동 보내지 않습니다. 패널 닫기/다른 화면 이동은 폴링만 중단하며 작업 취소는 별도 버튼입니다. 선택 변경·초기화·맵 삭제의 취소 규칙은 서버가 적용합니다. 늦게 도착한 이전 작업은 현재 선택·활성 결과를 바꾸지 못합니다. 만료 시 이전 탐색 참조를 지우고 홈으로 돌아갑니다. 새 키워드의 맵을 열면 `DELETE /api/v2/maps/{map_id}?include_issues=true`로 이전 검색에 속한 맵을 정리합니다.

같은 탭 `sessionStorage`에는 복원 위치를 정하는 표식 세 개를 더 둡니다(2026-11-11). 화면 위치·검색어·요청 식별값만 담습니다.

- `econmind.v2.keyword`: 지금 뉴스맵을 연 키워드 맵의 검색어입니다. 새로고침으로 화면 기록이 사라진 뉴스맵에서 **뒤로가기**를 누르면 이 검색어로 `GET /api/v1/keywords/map`을 다시 보내 키워드 맵으로 돌아갑니다. 검색어가 없으면 검색창으로 갑니다.

- `econmind.v2.away`: 뉴스맵에서 검색 화면으로 나간 상태입니다. 이때 새로고침하면 떠난 뉴스맵을 다시 열지 않고 검색창에 머뭅니다. 맵은 GET으로 읽어 두고 다음 검색에서 위 규칙대로 삭제합니다.
- `econmind.v2.branch`: 응답을 기다리는 가지 펼치기·재검색 요청의 `{map_id, node_id, revision, started_at}`입니다. 응답 전에 새로고침하면 그 카드의 대기 표시를 이어 가고, 맵 revision이 오를 때까지 1초 간격 GET으로 기다린 뒤 이후 조작을 보냅니다. 요청 후 30초가 지나도 맵이 그대로면 대기를 끝내고 안내합니다. POST는 다시 보내지 않습니다.

뉴스맵 생성 응답을 기다리는 동안에는 `beforeunload` 확인으로 페이지 이탈을 한 번 막습니다. 그래도 떠나면 서버가 만든 맵의 ID를 받지 못해 프론트에서 지울 수 없습니다.

테마 값과 위의 리포트 진행 경로 표식만 `localStorage`에 유지합니다. API 비밀키·DB 계정은 프론트에 넣지 않습니다.

## 로컬 실행

```bash
npm ci
VITE_API_BASE=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

로컬 실제 백엔드의 v2 설정, Redis·MongoDB·작업 큐·워커는 백엔드/배포 저장소의 로컬 실행 안내를 따릅니다. 프론트와 API를 모두 `127.0.0.1` 또는 모두 `localhost`로 실행해 쿠키 호스트를 일치시키세요. 동일 출처 프록시에서는 `VITE_API_BASE=''`를 사용합니다.

### 실제 NAVER·Decision 탐색

백엔드의 `scripts/run-newsmap-v2-local.py`로 실제 검색·선정 API를 8026 포트에 실행한 뒤 `npm run dev:live`로 5196 미리보기를 엽니다. 키워드맵은 `/api/v1/keywords/map`, 뉴스맵은 실제 `/api/v2`에 연결됩니다. 이슈 전환은 버튼이 제공되는 맵에서 연속으로 눌러 각 클릭의 POST를 확인하고, **이전 뉴스맵**으로 돌아가 기사 선택을 확인합니다.

현재 로컬 프로토타입은 PAID 기준으로 최대 10건을 추가·해제한다. 백엔드 로컬 실행 스크립트의 기본 티어가 PAID이며, 프론트는 실제 API 세션의 capability를 사용한다. 무료 선택 교체 동작은 백엔드를 `--tier FREE`로 실행해 검증한다.

2026-10-11 실제 NAVER·OpenAI Decisions로 반도체 초기 주변 4건/하위 3건과 국제유가 초기 2건(부족 상태)/하위 3건을 확인했습니다. 브라우저에서 실제 제목·설명·NAVER 원문 링크와 확장 후 새로고침 복원을 검증했습니다. 이 탐색 프로파일은 규칙 메타데이터와 로컬 MongoDB·Redis를 사용하며 본문 추출·리포트·전략·Atlas RAG는 별도 검증 범위입니다. 외부 인증키는 백엔드에만 있습니다.

실제 리포트는 백엔드를 `--with-reports`로 실행하고 같은 스크립트의 `--worker`를 별도 터미널에서 실행합니다. 2026-10-11 환율 기사 두 건을 각각 선택하여 실제 Diffbot 본문 추출·Gemini 리포트/critic/전략·MongoDB 저장·UI 표시를 확인했습니다(본문 6,081자 / 1,635자, 각각 coverage 1/1·실패 0건). 기존 전략 프롬프트가 리포트에 없는 종목을 추가하던 문제를 백엔드에서 수정했으며, UI도 리포트 근거 검증과 전략 제안을 구분해 표시합니다. 새로고침은 GET만으로 결과를 복원했습니다. 이 검증은 FREE 단일 기사 두 건의 소표본이고 Atlas RAG는 비활성화되어 있습니다.

복원 화면에서 브라우저 캐시로 이미 로드된 썸네일이 `onLoad` 대기 때문에 투명하게 남는 문제를 수정했습니다. 이미지 표시를 추가 로드 이벤트에 의존하지 않게 하고 URL별로 실패 상태를 분리하여, 새 기사로 변경하거나 새로고침해도 실제 사진과 실패 대체 표시가 맞게 전환됩니다.

### HTTP UI fixture

외부 API·DB·실제 AI 생성 없이 응답·쿠키·새로고침·패널을 확인하는 합성 fixture입니다.

```bash
python3 scripts/serve-v2-fixtures.py --port 9036
VITE_API_BASE=http://127.0.0.1:9036 npm run dev -- --host 127.0.0.1 --port 5196
```

HTTP fixture는 PAID(최대 10건)를 기본으로 하며 무료 검증은 `PROTOTYPE_TIER=FREE`로 실행합니다. `검증0`은 빈 맵, `검증부분`은 조회 제한/다중 기사 부분 본문 실패, `검증실패`는 모든 본문 실패, `검증전략실패`는 리포트 유지·전략 실패입니다. 합성 기사/본문/전략에는 fixture 표시가 있습니다. 상태는 서버 프로세스 메모리이며 서버 재시작에는 보존되지 않습니다. 실제 백엔드·Decision 선정 품질·DB 내구성 검증용이 아닙니다.

브라우저 내부 fixture도 명시적으로 선택할 수 있습니다.

```bash
VITE_NEWS_MAP_SOURCE=mock npm run dev
```

이 모드는 PAID(최대 10건)의 메모리 fixture입니다. 무료 검증은 `VITE_NEWS_MAP_MOCK_TIER=FREE`를 함께 지정합니다. 페이지 새로고침 시 새 fixture 세션이 시작됩니다. 새로고침 복원 검증은 위 HTTP fixture 또는 실제 로컬 API에서 진행하세요. 기본/API 모드의 실패를 내부 fixture나 완성된 샘플 리포트로 대체하지 않습니다.

### Docker UI fixture

```bash
docker compose up --build
# http://localhost:8080
PROTOTYPE_TIER=FREE docker compose up --build  # 무료 1건 선택 동작 검증
```

Compose 포트는 `127.0.0.1`로 제한합니다. mock 컨테이너는 `/api/v2` 합성 UI fixture를 실행합니다. 기존 `/api/v1` 전용 fixture는 `python3 mock-api/server.py`로 별도 실행할 수 있습니다. 실제 전체 스택은 `capstone-deploy`의 로컬 설정을 사용합니다.

## 로컬 검증

```bash
npm test
npm run build
python3 -m py_compile scripts/serve-v2-fixtures.py mock-api/v2.py
```

`npm test`는 main의 v1 회귀 20건과 v2 쿠키/저장 범위·복원·FREE/PAID 선택·동시 변경/revision·정보 부족·재시도 키·지연 작업·부분 성공·전략 실패·취소/초기화·트리 복원을 검사합니다. `npm run build`는 TypeScript 검사와 Vite 빌드입니다. HTTP/UI fixture 확인은 외부 연동이나 운영 배포 검증을 의미하지 않습니다.

2026-10-11 문서 동기화 시 현재 작업 트리에서 `npm test` **54 passed, 실패/skip 0**, `npm run build`의 TypeScript·Vite 빌드 성공을 재확인했습니다. 브라우저 화면과 실제 외부 API 연동은 이번 문서 작업에서 다시 실행하지 않았으며 위 실제 연동 절은 당시 검증 기록입니다.

새 뉴스맵 화면은 원본 프로토타입의 1280×832 데스크톱 구성을 중심으로 합니다. 홈·키워드맵은 기존 반응형 구성을 유지합니다.

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/App.tsx` | 홈·키워드·뉴스맵 전환, 같은 탭 복원, 이전 맵 정리 |
| `src/components/KeywordMap.tsx` | 검색어 기준 2궤도(`issue` / `entity`) 초기 키워드맵 렌더링 |
| `src/components/NewsMapExplorer.tsx` | 뉴스맵·상세·리포트 패널·서버 진행/근거 표시 |
| `src/data/newsMapService.ts` | 키워드맵(`GET /api/v1/keywords/map`) 및 v2 DTO, 쿠키 HTTP, revision/작업/결과 제어 |
| `src/layout/mapLayout.ts` | 키워드맵 2궤도 좌표·크기·폰트 보정 배치 |
| `src/layout/newsTree.ts` | 서버 트리 복원, 로컬 좌표·카메라·물리 배치 |
| `src/data/mockV2.ts` | 명시적 브라우저 UI fixture |
| `mock-api/v2.py` | 명시적 로컬 HTTP UI fixture |
| `scripts/test-news-map-v2.mjs` | 키워드맵·뉴스맵 v2 계약·상태 경합·복원·정렬 회귀 |
| `src/data/apiAdapter.ts` | 보존한 v1 데이터·세션 어댑터 |

프로젝트 문서 정본은 [econmind-docs](https://github.com/DKU-CE-Capstone-Project/econmind-docs)입니다. 이번 코드 작업에서 정본 문서를 자동 갱신하지 않았습니다.
