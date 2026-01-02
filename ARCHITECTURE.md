# 시스템 아키텍처

## 프론트엔드/백엔드 구조

현재 시스템은 **모노리식 구조(Monolithic Architecture)**로 구성되어 있습니다.

### 구조 설명

```
┌─────────────────────────────────────┐
│         Express Server              │
│  (Node.js - server.js)              │
├─────────────────────────────────────┤
│  프론트엔드 (Static Files)          │
│  - public/index.html                │
│  - public/app.js                    │
│  - public/styles.css                │
│  → app.use(express.static('public'))│
├─────────────────────────────────────┤
│  백엔드 API (REST API)               │
│  - /api/*                           │
│  - routes/*.js                      │
│  - services/*.js                     │
└─────────────────────────────────────┘
```

### 접근 경로

- **프론트엔드**: `http://localhost:3000/` (루트)
- **백엔드 API**: `http://localhost:3000/api/*`

### 장점

1. 단일 서버로 운영 간단
2. 배포가 쉬움 (하나의 Docker 이미지)
3. CORS 문제 없음
4. 개발 및 유지보수 용이

### 분리 가능성

필요시 프론트엔드와 백엔드를 분리할 수 있습니다:

**옵션 1: 별도 프론트엔드 서버**
- React, Vue, Next.js 등으로 별도 프로젝트 생성
- 백엔드 API만 제공하는 Express 서버

**옵션 2: 현재 구조 유지 (권장)**
- 관리자 페이지는 현재 구조로 충분
- 단일 배포로 운영 간단

## 환경 변수 설정

Azure 서비스는 선택사항입니다. 설정하지 않아도 기본 기능은 작동합니다:

### 필수 환경 변수
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (PostgreSQL)

### 선택적 환경 변수
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` (Azure OpenAI - 임베딩/보정용)
- `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_API_KEY` (Azure AI Search - 선택적 인덱싱)
- `YOUTUBE_API_KEY` (YouTube 메타데이터 - 선택적)

Azure 설정이 없으면:
- PostgreSQL 벡터 검색만 사용
- Azure AI Search 인덱싱은 스킵
- 관리자 페이지에서 API 키로 OpenAI, Claude 등 사용 가능
