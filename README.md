# 안양제일교회 YouTube RAG 시스템

YouTube 구간 영상에서 자막을 추출하고, AI로 보정하여 완전한 문장으로 변환한 후, 500자 단위로 청킹하고 메타데이터를 추출하여 벡터 임베딩 및 하이브리드 RAG 검색 시스템을 구축합니다.

## 기능

- YouTube 구간 영상 자막 추출 (자막/STT 자동 선택)
- AI 기반 자막 보정 (문법, 오타 수정)
- 문장 완성 (자막 이어 붙이기)
- 메타데이터 추출 (주일예배 날짜, 예배 유형)
- 500자 청킹 (메타데이터 포함)
- 벡터 임베딩 생성 (Azure OpenAI)
- Azure AI Search 인덱싱
- 하이브리드 RAG 검색 (키워드 + 벡터)

## 설치

```bash
npm install
```

## 환경 변수 설정

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```env
# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_GPT_DEPLOYMENT=gpt-4

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_API_KEY=your-search-key
AZURE_SEARCH_INDEX_NAME=anyang-church-transcripts

# YouTube (선택)
YOUTUBE_API_KEY=your-youtube-api-key

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=anyang_church
DB_USER=postgres
DB_PASSWORD=postgres
```

**참고**: PostgreSQL에 pgvector 확장이 설치되어 있어야 합니다.

## 실행

```bash
npm start
```

## API 엔드포인트

### 1. 자막 추출
```bash
POST /api/extract
Body: {
  "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
  "startTime": "38:40",
  "endTime": "1:14:40"
}
```

### 2. AI 보정
```bash
POST /api/correct
Body: {
  "transcript": [...]
}
```

### 3. 전체 파이프라인
```bash
POST /api/process
Body: {
  "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
  "startTime": "38:40",
  "endTime": "1:14:40",
  "autoIndex": true
}
```

### 4. 인덱싱
```bash
POST /api/index
Body: {
  "chunks": [...]
}
```

### 5. 하이브리드 검색
```bash
POST /api/search
Body: {
  "query": "검색어",
  "serviceType": "주일예배",
  "serviceDateFrom": "2024-01-01",
  "serviceDateTo": "2024-12-31",
  "top": 5
}
```

### 6. RAG 질의응답
```bash
POST /api/search/rag
Body: {
  "query": "질문",
  "serviceType": "주일예배"
}
```

### 7. AI API 키 관리
```bash
# 모든 키 조회
GET /api/ai-keys

# 키 저장
POST /api/ai-keys
Body: {
  "provider": "openai",
  "apiKey": "sk-...",
  "name": "main-key"
}

# 키 수정
PUT /api/ai-keys/:id
Body: {
  "apiKey": "sk-new...",
  "is_active": true
}

# 키 삭제
DELETE /api/ai-keys/:id
```

### 8. 성경 검색
```bash
POST /api/bible/search
Body: {
  "query": "사랑",
  "testament": "신약",
  "top": 10
}
```

### 9. Podcast 생성
```bash
POST /api/podcast/generate
Body: {
  "text": "설교 원문...",
  "options": {
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
  }
}
```

### 10. 이미지 생성
```bash
POST /api/image/generate
Body: {
  "prompt": "교회 설교 장면",
  "options": {
    "width": 1024,
    "height": 1024
  }
}
```

## 파일 구조

```
AJAICHAT/
├── package.json
├── server.js
├── .env
├── config/
│   ├── azureConfig.js
│   └── youtubeConfig.js
├── services/
│   ├── youtubeService.js
│   ├── correctionService.js
│   ├── embeddingService.js
│   ├── searchService.js
│   └── indexService.js
├── utils/
│   ├── timeParser.js
│   ├── sentenceCompleter.js
│   ├── metadataExtractor.js
│   ├── textChunker.js
│   └── youtubeDownloader.js
├── routes/
│   ├── extract.js
│   ├── correct.js
│   ├── process.js
│   ├── index.js
│   └── search.js
└── README.md
```

## 참고사항

- FFmpeg가 시스템에 설치되어 있어야 합니다 (STT 사용 시)
- Azure OpenAI 및 Azure AI Search 서비스가 필요합니다
- YouTube API 키는 메타데이터 추출에 사용됩니다 (선택사항)
