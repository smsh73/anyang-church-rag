# 관리자 페이지

안양제일교회 YouTube RAG 시스템의 관리자 페이지입니다.

## 기능

### 1. 벡터 임베딩 생성
- YouTube URL 입력
- 시작/종료 시간 지정 (선택)
- Azure AI Search 자동 인덱싱 옵션
- 실시간 진행 상황 표시
- 결과 상세 정보 표시

### 2. API 키 설정
- OpenAI, Claude, Gemini, Perplexity, ElevenLabs, Nano Banana Pro API 키 관리
- API 키 추가, 수정, 삭제, 활성화/비활성화
- 여러 개의 API 키 등록 가능 (이름으로 구분)

### 3. 상태 확인
- PostgreSQL 연결 상태
- Azure AI Search 인덱스 상태
- 인덱스 동기화 실행

## 접근 방법

서버 실행 후 브라우저에서 접근:
```
http://localhost:3000
```

또는 Azure 배포 후:
```
https://your-app-service.azurewebsites.net
```

## YouTube API 키

**YouTube API 키는 선택사항입니다.**

- API 키가 있으면: YouTube Data API를 통해 정확한 제목과 업로드 날짜를 가져옵니다.
- API 키가 없으면: URL이나 제목에서 메타데이터를 파싱합니다.

YouTube API 키가 필요한 경우:
1. Google Cloud Console에서 프로젝트 생성
2. YouTube Data API v3 활성화
3. API 키 생성
4. 관리자 페이지의 "API 키 설정"에서 등록 (provider: youtube는 현재 지원하지 않지만, 환경 변수로 설정 가능)

현재는 YouTube API 키 없이도 정상 작동합니다.
