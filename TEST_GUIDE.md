# 테스트 가이드

## 테스트 스크립트

### 1. 기본 API 테스트
```bash
npm test
```
또는
```bash
node test-api.js
```

기본 API 엔드포인트들을 테스트합니다:
- Health Check
- Root Endpoint
- AI Keys API (CRUD)
- Bible Search API

### 2. 통합 테스트
```bash
npm run test:integration
```
또는
```bash
node test-integration.js
```

전체 플로우를 테스트합니다:
- Health Check
- API Keys 관리
- Sync Status
- YouTube 스크립트 처리 (전체 플로우)
- 검색 및 RAG 응답

## 통합 테스트 환경 변수

전체 플로우 테스트를 실행하려면 다음 환경 변수를 설정하세요:

```bash
export TEST_YOUTUBE_URL="https://www.youtube.com/watch?v=VIDEO_ID"
export TEST_START_TIME="0:00"
export TEST_END_TIME="1:00"
export TEST_OPENAI_KEY="sk-..."  # 선택사항 (API Keys에 이미 등록되어 있으면 불필요)
```

## 테스트 실행 예시

### 로컬 서버에서 테스트
```bash
# 1. 서버 시작 (별도 터미널)
npm start

# 2. 기본 테스트 실행
npm test

# 3. 통합 테스트 실행 (환경 변수 설정 후)
export TEST_YOUTUBE_URL="https://www.youtube.com/watch?v=YSik-AHcFog"
export TEST_START_TIME="0:00"
export TEST_END_TIME="1:00"
npm run test:integration
```

### Azure App Service에서 테스트
```bash
# API URL 변경
export API_URL="https://anyang-church-app.azurewebsites.net"
npm test
npm run test:integration
```

## 테스트 결과 해석

### ✅ 통과
- 모든 기능이 정상 작동

### ❌ 실패
- 기능에 문제가 있음
- 로그를 확인하여 원인 파악

### ⚠️ 스킵
- 필수 설정이 없어 테스트를 건너뜀
- 예: 데이터베이스 미연결, YouTube URL 없음, API Key 없음

## 주의사항

1. **데이터베이스 연결**: PostgreSQL이 실행 중이어야 합니다.
2. **OpenAI API Key**: 임베딩 및 RAG 테스트를 위해 필요합니다.
3. **YouTube URL**: 실제 접근 가능한 YouTube 비디오 URL이 필요합니다.
4. **Azure AI Search**: 하이브리드 검색 테스트를 위해 선택적으로 필요합니다.

## 문제 해결

### "서버가 실행 중이 아닙니다"
- 서버를 먼저 시작하세요: `npm start`

### "Node.js 18+ 또는 node-fetch 패키지가 필요합니다"
- Node.js 18 이상을 사용하거나 `npm install node-fetch` 실행

### "OpenAI API key not found"
- 설정 페이지에서 OpenAI API Key를 등록하세요
- 또는 `TEST_OPENAI_KEY` 환경 변수 설정

### "Database initialization failed"
- PostgreSQL이 실행 중인지 확인
- 환경 변수 설정 확인 (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD)
