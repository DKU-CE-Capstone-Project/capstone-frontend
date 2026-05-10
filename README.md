# Capstone Frontend

실시간 뉴스 기반 멀티 에이전트 투자 판단 지원 시스템의 프론트엔드입니다.

React, TypeScript, Vite 기반으로 구현되어 있으며, 백엔드의 9주차 API 명세서 기준 `/api/v1` 엔드포인트와 연결됩니다.

## 기술 스택

- React 19
- TypeScript
- Vite
- lucide-react

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

3. 뉴스맵
   - 중심 뉴스 기준으로 `GET /api/v1/news/{news_id}/graph`와 `GET /api/v1/news/{news_id}/related`를 호출합니다.
   - 관련 뉴스는 원형 노드 형태로 표시됩니다.

4. 뉴스 상세
   - `GET /api/v1/news/{news_id}/source`를 호출해 원문 출처 정보를 가져옵니다.
   - 원문 링크는 본문과 분리된 `원문 링크` 영역에 표시됩니다.

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

## 프로젝트 구조

```text
src/
  App.tsx                 화면 전환, 사용자 액션, 주요 UI 컴포넌트
  main.tsx                React 엔트리 포인트
  styles.css              전체 스타일
  data/
    apiAdapter.ts         백엔드 /api/v1 응답을 프론트 데이터 형태로 변환
    mockData.ts           API 실패 시 사용하는 로컬 fallback 데이터와 타입 정의
```

## mock 데이터

프론트의 fallback mock 데이터는 `src/data/mockData.ts`에 있습니다.

현재 앱은 백엔드 API 호출을 우선 사용합니다. 단, 다음 상황에서는 프론트 mock 데이터가 화면에 보일 수 있습니다.

- 백엔드 서버가 실행 중이 아닌 경우
- 백엔드 CORS 설정에 현재 프론트 포트가 빠진 경우
- API 요청이 실패한 경우
- 아직 API 응답을 받기 전 초기 렌더링 상태
- 리포트/전략 API가 백엔드 fallback 문구를 반환한 경우

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

## 사용 API

프론트에서 사용하는 주요 API는 다음과 같습니다.

- `GET /api/v1/keywords/recommended`
- `GET /api/v1/news/search`
- `GET /api/v1/news/{news_id}/graph`
- `GET /api/v1/news/{news_id}/related`
- `GET /api/v1/news/{news_id}/source`
- `POST /api/v1/reports`
- `GET /api/v1/reports/{report_id}`
- `POST /api/v1/strategies`
- `GET /api/v1/strategies/{strategy_id}`

## 주의 사항

- 프론트와 백엔드를 다른 포트에서 실행할 경우, 백엔드 CORS 허용 목록에 프론트 Origin이 포함되어 있어야 합니다.
- `VITE_API_BASE`를 변경했다면 개발 서버를 재시작해야 반영됩니다.
- `dist/`와 `node_modules/`는 Git에 올리지 않습니다.

## 라이선스

본 프로젝트는 단국대학교 캡스톤 디자인 과목 학습 목적으로 작성되었습니다.
