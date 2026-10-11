# EconMind Frontend

React 19 · TypeScript · Vite 기반 뉴스맵 프론트엔드입니다. 2026-10-11 `origin/main` (`4f0bea6`)에서 시작한 로컬 `codex/newsmap-v2-20261011` 구현입니다. 새 뉴스맵 UI는 `origin/newsmap-prototype-mock`의 화면·트리 배치를 재사용하고, 탐색·선택·리포트를 정본 [API v2 설계](https://github.com/DKU-CE-Capstone-Project/econmind-docs/blob/main/docs/10-newsmap-prototype-api-design.md)에 연결했습니다. 원격 반영·배포 기록이 아닙니다.

## 현재 연결

- 홈 추천과 키워드맵은 설계대로 `fetchMockRecommendedKeywords` / `fetchMockKeywordMap`을 사용합니다. 이 화면에서 서버 뉴스 검색·본문 추출을 시작하지 않습니다.
- 뉴스맵은 `POST /api/v2/maps`의 중심·최초 주변 4건과 서버 선정 순서를 표시합니다. Space+클릭 또는 Shift+Enter로 가지 펼치기·재검색(하위 목표 3건)을 요청합니다. 중심 이동·휠·끌기·미니맵은 프론트 좌표만 바꿉니다.
- 뉴스맵 캔버스에는 기사 카드와 카드에서 펼친 가지를 표시합니다. 프로토타입의 키워드 노드·키워드 점선·바깥 키워드 궤도·키워드맵 이동 동작은 제거했습니다. 기사 키워드는 상세 패널의 태그로 제공합니다.
- 서버의 `Session.capabilities`를 읽습니다. FREE는 선택 1건 교체·해제, PAID 프로토타입 설정은 최대 10건 추가·해제입니다. 클라이언트가 요청 본문에 티어를 보내지 않습니다. 로그인·결제 검증은 포함하지 않습니다.
- 변경에는 `expected_revision`을 붙입니다. 카드 연속 클릭을 직렬화하고 409 충돌은 최신 맵을 다시 읽은 뒤 오류를 표시합니다. 재검색 0건은 서버가 반환한 기존 가지·선택을 유지합니다. 부족·일시적인 부분 결과·외부 실패를 구분하며 샘플 기사로 채우지 않습니다.
- 리포트는 선택한 실제 `news_id`만 `POST /api/v2/report-jobs`에 보냅니다. 선택하지 않은 중심을 추가하지 않습니다. `Idempotency-Key`와 요청 UUID를 사용하며 네트워크/큐 접수 재시도에서 동일 입력·키를 유지합니다.
- 생성 단계와 처리·성공·실패 건수는 GET 작업 응답을 표시합니다. 임의 백분율·추정 진행률을 만들지 않습니다. 완료 후 맵 revision·활성 작업·결과 연결을 확인하고 리포트와 별도 전략을 읽습니다.
- 성공 본문·실패 기사·coverage·본문 절단 여부·자동 검색 참고 자료·critic 검증 상태를 구분합니다. 전략 실패는 완성된 리포트를 유지하며 전략 행동과 주가 영향 방향을 서로 바꾸지 않습니다. 확인되지 않은 종목 코드·영향 방향도 그대로 표시합니다.
- 상세는 카드의 description·태그·원문 링크를 사용합니다. 탐색/상세에서 본문 추출을 요청하지 않습니다. 백테스트·성과 차트·연관도 상세·심화 리포트는 보류합니다.
- 뉴스 카드·상세·리포트 근거 썸네일은 API의 실제 `thumbnail_url`을 표시합니다. 사진 비율은 유지하면서 영역에 맞춰 자르고, URL이 없거나 로딩에 실패하면 이미지 없음 아이콘과 톤 배경을 표시합니다. 다른 기사의 사진으로 대체하지 않습니다.

## 세션과 복원

요청은 `credentials: include`와 HttpOnly `econmind_sid` 쿠키를 사용합니다. 같은 탭 `sessionStorage`의 `econmind.v2.navigation`에는 `{session_epoch, map_id}`만 저장합니다. 트리·리포트·세션 비밀 ID를 브라우저 저장소에 복사하지 않습니다. 기존 main의 v1 어댑터·세션 보안 구현은 보존했습니다.

새로고침은 GET 세션 → GET 기존 맵 → GET 기존 활성 작업/최종 결과 순서입니다. 새 생성 POST를 자동 보내지 않습니다. 패널 닫기/다른 화면 이동은 폴링만 중단하며 작업 취소는 별도 버튼입니다. 선택 변경·초기화·맵 삭제의 취소 규칙은 서버가 적용합니다. 늦게 도착한 이전 작업은 현재 선택·활성 결과를 바꾸지 못합니다. 만료 시 이전 탐색 참조를 지우고 홈으로 돌아갑니다. 새 키워드로 이동하면 이전 맵을 DELETE로 정리합니다.

테마 값만 기존 `localStorage`에 유지합니다. API 비밀키·DB 계정은 프론트에 넣지 않습니다.

## 로컬 실행

```bash
npm ci
VITE_API_BASE=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 --port 5173
```

로컬 실제 백엔드의 v2 설정, Redis·MongoDB·작업 큐·워커는 백엔드/배포 저장소의 로컬 실행 안내를 따릅니다. 프론트와 API를 모두 `127.0.0.1` 또는 모두 `localhost`로 실행해 쿠키 호스트를 일치시키세요. 동일 출처 프록시에서는 `VITE_API_BASE=''`를 사용합니다.

### 실제 NAVER·Decision 탐색

백엔드의 `scripts/run-newsmap-v2-local.py`로 실제 검색·선정 API를 8026 포트에 실행한 뒤 `npm run dev:live`로 5196 미리보기를 엽니다. 이 명령은 브라우저 mock을 끄고 실제 `/api/v2`에 연결합니다. 홈 추천·키워드맵은 설계대로 고정 mock을 유지하며 뉴스맵을 열 때 실제 검색을 시작합니다.

2026-10-11 실제 NAVER·OpenAI Decisions로 반도체 초기 주변 4건/하위 3건과 국제유가 초기 2건(부족 상태)/하위 3건을 확인했습니다. 브라우저에서 실제 제목·설명·NAVER 원문 링크와 확장 후 새로고침 복원을 검증했습니다. 이 탐색 프로파일은 규칙 메타데이터와 로컬 MongoDB·Redis를 사용하며 본문 추출·리포트·전략·Atlas RAG는 별도 검증 범위입니다. 외부 인증키는 백엔드에만 있습니다.

실제 리포트는 백엔드를 `--with-reports`로 실행하고 같은 스크립트의 `--worker`를 별도 터미널에서 실행합니다. 2026-10-11 환율 기사 두 건을 각각 선택하여 실제 Diffbot 본문 추출·Gemini 리포트/critic/전략·MongoDB 저장·UI 표시를 확인했습니다(본문 6,081자 / 1,635자, 각각 coverage 1/1·실패 0건). 기존 전략 프롬프트가 리포트에 없는 종목을 추가하던 문제를 백엔드에서 수정했으며, UI도 리포트 근거 검증과 전략 제안을 구분해 표시합니다. 새로고침은 GET만으로 결과를 복원했습니다. 이 검증은 FREE 단일 기사 두 건의 소표본이고 Atlas RAG는 비활성화되어 있습니다.

복원 화면에서 브라우저 캐시로 이미 로드된 썸네일이 `onLoad` 대기 때문에 투명하게 남는 문제를 수정했습니다. 이미지 표시를 추가 로드 이벤트에 의존하지 않게 하고 URL별로 실패 상태를 분리하여, 새 기사로 변경하거나 새로고침해도 실제 사진과 실패 대체 표시가 맞게 전환됩니다.

### HTTP UI fixture

외부 API·DB·실제 AI 생성 없이 응답·쿠키·새로고침·패널을 확인하는 합성 fixture입니다.

```bash
PROTOTYPE_TIER=FREE python3 scripts/serve-v2-fixtures.py --port 9036
VITE_API_BASE=http://127.0.0.1:9036 npm run dev -- --host 127.0.0.1 --port 5196
```

PAID 검증은 fixture를 `PROTOTYPE_TIER=PAID`로 새 포트에서 실행합니다. `검증0`은 빈 맵, `검증부분`은 조회 제한/다중 기사 부분 본문 실패, `검증실패`는 모든 본문 실패, `검증전략실패`는 리포트 유지·전략 실패입니다. 합성 기사/본문/전략에는 fixture 표시가 있습니다. 상태는 서버 프로세스 메모리이며 서버 재시작에는 보존되지 않습니다. 실제 백엔드·Decision 선정 품질·DB 내구성 검증용이 아닙니다.

브라우저 내부 fixture도 명시적으로 선택할 수 있습니다.

```bash
VITE_NEWS_MAP_SOURCE=mock npm run dev
```

이 모드는 FREE의 메모리 fixture입니다. 페이지 새로고침 시 새 fixture 세션이 시작됩니다. 새로고침 복원 검증은 위 HTTP fixture 또는 실제 로컬 API에서 진행하세요. 기본/API 모드의 실패를 내부 fixture나 완성된 샘플 리포트로 대체하지 않습니다.

### Docker UI fixture

```bash
docker compose up --build
# http://localhost:8080
PROTOTYPE_TIER=PAID docker compose up --build
```

Compose 포트는 `127.0.0.1`로 제한합니다. mock 컨테이너는 `/api/v2` 합성 UI fixture를 실행합니다. 기존 `/api/v1` 전용 fixture는 `python3 mock-api/server.py`로 별도 실행할 수 있습니다. 실제 전체 스택은 `capstone-deploy`의 로컬 설정을 사용합니다.

## 로컬 검증

```bash
npm test
npm run build
python3 -m py_compile scripts/serve-v2-fixtures.py mock-api/v2.py
```

`npm test`는 main의 v1 회귀 20건과 v2 쿠키/저장 범위·복원·FREE/PAID 선택·동시 변경/revision·정보 부족·재시도 키·지연 작업·부분 성공·전략 실패·취소/초기화·트리 복원을 검사합니다. `npm run build`는 TypeScript 검사와 Vite 빌드입니다. HTTP/UI fixture 확인은 외부 연동이나 운영 배포 검증을 의미하지 않습니다.

새 뉴스맵 화면은 원본 프로토타입의 1280×832 데스크톱 구성을 중심으로 합니다. 홈·키워드맵은 기존 반응형 구성을 유지합니다.

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/App.tsx` | 홈·키워드·뉴스맵 전환, 같은 탭 복원, 이전 맵 정리 |
| `src/components/NewsMapExplorer.tsx` | 뉴스맵·상세·리포트 패널·서버 진행/근거 표시 |
| `src/data/newsMapService.ts` | v2 DTO, 쿠키 HTTP, revision/작업/결과 제어 |
| `src/layout/newsTree.ts` | 서버 트리 복원, 로컬 좌표·카메라·물리 배치 |
| `src/data/mockV2.ts` | 명시적 브라우저 UI fixture |
| `mock-api/v2.py` | 명시적 로컬 HTTP UI fixture |
| `scripts/test-news-map-v2.mjs` | v2 계약·상태 경합·복원 회귀 |
| `src/data/apiAdapter.ts` | 보존한 v1 데이터·세션 어댑터 |

프로젝트 문서 정본은 [econmind-docs](https://github.com/DKU-CE-Capstone-Project/econmind-docs)입니다. 이번 코드 작업에서 정본 문서를 자동 갱신하지 않았습니다.
