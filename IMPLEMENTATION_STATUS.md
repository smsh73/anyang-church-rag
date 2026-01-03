# 구현 상태 확인

## 요구사항 플로우

### ✅ 1. YouTube 스크립트 추출
- **구현 위치**: `services/youtubeService.js`
- **기능**: 
  - 자막 추출 시도 (youtube-transcript)
  - 자막이 없으면 STT 사용 (ytdl-core + Whisper)
- **상태**: ✅ 완료

### ✅ 2. 텍스트 청킹 (의미 단위 분할)
- **구현 위치**: `utils/textChunker.js`
- **기능**:
  - 500자 단위로 청킹
  - 20% 오버랩 적용
  - 메타데이터를 헤더에 포함하여 임베딩
- **상태**: ✅ 완료

### ✅ 3. OpenAI 임베딩 생성 (별도 OpenAI API key 우선 사용)
- **구현 위치**: `services/embeddingService.js`
- **기능**:
  - **우선순위 1**: 저장된 OpenAI API key 사용 (`ai_api_keys` 테이블)
  - **우선순위 2**: Azure OpenAI 사용 (fallback)
  - 모델: `text-embedding-ada-002` (768차원)
- **상태**: ✅ 완료 (방금 수정됨)

### ✅ 4. Azure AI Search 인덱싱
- **구현 위치**: `services/indexService.js`
- **기능**:
  - 인덱스 생성/업데이트
  - 문서 인덱싱 (배치 처리)
  - 벡터 검색 프로필 설정
- **상태**: ✅ 완료

### ✅ 5. 하이브리드 검색 (키워드 + 벡터)
- **구현 위치**: `services/searchService.js`
- **기능**:
  - 키워드 검색 (BM25)
  - 벡터 검색 (코사인 유사도)
  - Azure AI Search의 하이브리드 검색 사용
- **상태**: ✅ 완료

### ✅ 6. RAG 응답 생성
- **구현 위치**: `services/searchService.js` (ragQuery 함수)
- **기능**:
  - 하이브리드 검색으로 관련 문서 검색
  - 검색된 문서를 컨텍스트로 사용
  - **우선순위 1**: 저장된 OpenAI API key 사용
  - **우선순위 2**: Azure OpenAI 사용 (fallback)
  - GPT-4로 응답 생성
- **상태**: ✅ 완료 (방금 수정됨)

## 전체 플로우

```
YouTube 스크립트 추출
    ↓
텍스트 청킹 (500자, 20% 오버랩)
    ↓
OpenAI 임베딩 생성 (OpenAI API key 우선 사용)
    ↓
Azure AI Search 인덱싱
    ↓
하이브리드 검색 (키워드 + 벡터)
    ↓
RAG 응답 생성 (OpenAI API key 우선 사용)
```

## API 엔드포인트

### 벡터 임베딩 생성
- **POST** `/api/process`
  - YouTube URL, 시작/종료 시간 입력
  - 전체 파이프라인 실행

### 하이브리드 검색
- **POST** `/api/search`
  - 쿼리 입력
  - 키워드 + 벡터 하이브리드 검색 결과 반환

### RAG 질의응답
- **POST** `/api/search/rag`
  - 질문 입력
  - 검색된 문서를 바탕으로 AI 응답 생성

## 설정 요구사항

### 필수
1. **OpenAI API Key**: 설정 페이지에서 등록 (우선 사용)
2. **Azure AI Search**: 환경 변수 설정
   - `AZURE_SEARCH_ENDPOINT`
   - `AZURE_SEARCH_API_KEY`

### 선택
- **Azure OpenAI**: OpenAI API key가 없을 때 fallback으로 사용
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`

## 최근 수정 사항

1. **embeddingService.js**: OpenAI API key를 우선 사용하도록 변경
2. **searchService.js**: 
   - 쿼리 임베딩 생성 시 OpenAI API key 우선 사용
   - RAG 응답 생성 시 OpenAI API key 우선 사용
