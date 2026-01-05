# 배치 처리 가이드

## 개요

YouTube 채널 또는 재생목록의 모든 동영상을 자동으로 처리하는 배치 처리 기능입니다.

## 기능

1. **채널 배치 처리**: 채널의 모든 동영상을 최신순으로 처리
2. **재생목록 배치 처리**: 재생목록의 모든 동영상을 처리
3. **키워드 필터링**: 제목/설명에 특정 키워드가 포함된 동영상만 처리
4. **전체 파이프라인 자동 실행**:
   - 자막 추출 (YouTube API / youtube-transcript / STT)
   - AI 보정
   - 텍스트 정리
   - 문단 생성
   - 메타데이터 추출
   - 청킹 (500자, 20% 오버랩)
   - 벡터 임베딩 생성
   - PostgreSQL 저장
   - Azure AI Search 인덱싱 (선택)

## 사용 방법

### 1. 관리자 페이지 사용

1. 관리자 페이지 접속: `http://localhost:3000`
2. "배치 처리" 탭 클릭
3. 채널 URL 또는 재생목록 URL 입력
4. 키워드 필터 (선택사항) 입력
5. 최대 동영상 수 설정 (선택사항)
6. "배치 처리 시작" 버튼 클릭

### 2. API 직접 호출

#### 채널 배치 처리

```bash
POST /api/batch/channel/sync
Content-Type: application/json

{
  "channelUrl": "https://www.youtube.com/@channelname",
  "keyword": "주일예배",  // 선택사항
  "maxVideos": 10,  // 선택사항
  "autoIndex": false,  // 선택사항
  "delayBetweenVideos": 5000  // 선택사항 (밀리초)
}
```

#### 재생목록 배치 처리

```bash
POST /api/batch/playlist/sync
Content-Type: application/json

{
  "playlistUrl": "https://www.youtube.com/playlist?list=PLxxxxx",
  "keyword": "설교",  // 선택사항
  "maxVideos": 20,  // 선택사항
  "autoIndex": true  // 선택사항
}
```

## 지원하는 URL 형식

### 채널 URL
- `https://www.youtube.com/@channelname`
- `https://www.youtube.com/channel/UCxxxxx`
- `https://www.youtube.com/c/channelname`
- `https://www.youtube.com/user/username`

### 재생목록 URL
- `https://www.youtube.com/playlist?list=PLxxxxx`
- `https://www.youtube.com/watch?v=xxxxx&list=PLxxxxx`

## 필요한 API 키

### 필수
- **YouTube Data API 키**: 채널/재생목록 동영상 목록 가져오기
  - 관리자 페이지에서 "YouTube Data API" 키 추가
  - 또는 환경 변수 `YOUTUBE_API_KEY` 설정

### 선택사항 (기능별)
- **OpenAI API 키**: AI 보정, 메타데이터 추출, 벡터 임베딩
  - 관리자 페이지에서 "OpenAI" 키 추가
  - 또는 Azure OpenAI 설정 사용

## 전체 파이프라인 단계

각 동영상에 대해 다음 단계가 자동으로 실행됩니다:

1. **자막 추출**
   - YouTube Data API (우선)
   - youtube-transcript 라이브러리
   - STT (자막이 없는 경우)

2. **AI 보정**
   - OpenAI GPT를 사용한 문법/오타 수정

3. **텍스트 정리**
   - 불필요한 기호 제거
   - 특수 문자 정리

4. **문단 생성**
   - 완전한 문단으로 변환

5. **메타데이터 추출**
   - 설교자, 주제, 성경말씀, 날짜 등

6. **청킹**
   - 500자 단위로 분할
   - 20% 오버랩

7. **벡터 임베딩**
   - OpenAI text-embedding-ada-002 (768차원)

8. **PostgreSQL 저장**
   - 전체 텍스트 저장
   - 청크별 저장

9. **Azure AI Search 인덱싱** (선택)
   - 하이브리드 검색을 위한 인덱싱

## 테스트

### 전체 파이프라인 테스트

```bash
node test-batch-pipeline.js
```

### 환경 변수 설정

```bash
# 단일 동영상 테스트
TEST_VIDEO_URL=https://www.youtube.com/watch?v=xxxxx

# 채널 테스트
TEST_CHANNEL_URL=https://www.youtube.com/@channelname
TEST_KEYWORD=주일예배
TEST_MAX_VIDEOS=5

# 재생목록 테스트
TEST_PLAYLIST_URL=https://www.youtube.com/playlist?list=PLxxxxx
```

## 주의사항

1. **API 할당량**: YouTube Data API는 일일 할당량이 있습니다 (기본 10,000 units/day)
   - `captions.list`: 50 units
   - `captions.download`: 50 units
   - `channels.list`: 1 unit
   - `playlistItems.list`: 1 unit

2. **처리 시간**: 동영상당 약 1-5분 소요
   - 자막 추출: 10-30초
   - AI 보정: 10-30초
   - 벡터 임베딩: 5-10초
   - 저장: 1-5초

3. **대기 시간**: `delayBetweenVideos` 설정으로 API 할당량 관리

4. **에러 처리**: 개별 동영상 실패 시에도 다음 동영상 계속 처리

## 문제 해결

### "YouTube API key is not configured"
- 관리자 페이지에서 "YouTube Data API" 키 추가
- 또는 환경 변수 `YOUTUBE_API_KEY` 설정

### "Channel not found"
- 채널 URL 형식 확인
- 채널이 공개되어 있는지 확인

### "Playlist not found"
- 재생목록 URL 형식 확인
- 재생목록이 공개되어 있는지 확인

### "YouTube API quota exceeded"
- 일일 할당량 초과
- 다음 날까지 대기 또는 할당량 증가 요청

## 예제

### 채널의 최근 10개 동영상 처리

```bash
curl -X POST "http://localhost:3000/api/batch/channel/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "channelUrl": "https://www.youtube.com/@channelname",
    "maxVideos": 10,
    "autoIndex": false
  }'
```

### 재생목록에서 "설교" 키워드 포함 동영상만 처리

```bash
curl -X POST "http://localhost:3000/api/batch/playlist/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "playlistUrl": "https://www.youtube.com/playlist?list=PLxxxxx",
    "keyword": "설교",
    "autoIndex": true
  }'
```
