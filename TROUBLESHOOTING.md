# 문제 해결 가이드

## YouTube 비디오 처리 오류 해결

### 오류: "YouTube 비디오를 다운로드할 수 없습니다"

이 오류는 다음과 같은 경우에 발생할 수 있습니다:

#### 1. 자막 추출 실패
- 비디오에 자막이 없음
- 자막이 비공개로 설정됨
- YouTube 정책 변경으로 인한 접근 제한

#### 2. 오디오 다운로드 실패
- ytdl-core 실패 (410, 403, 404 에러)
- yt-dlp 실패
- 네트워크 문제

### 해결 방법

#### 방법 1: YouTube Data API 키 설정 (권장)

YouTube Data API를 사용하면 더 안정적으로 자막을 가져올 수 있습니다.

1. **Google Cloud Console에서 API 키 생성**
   - https://console.cloud.google.com/ 접속
   - 프로젝트 선택 또는 생성
   - "API 및 서비스" > "라이브러리"
   - "YouTube Data API v3" 검색 및 활성화
   - "API 및 서비스" > "사용자 인증 정보" > "API 키" 생성

2. **Azure App Service에 환경 변수 설정**
   ```bash
   az webapp config appsettings set \
     --name anyang-church-app \
     --resource-group anyang-church-rg \
     --settings YOUTUBE_API_KEY="YOUR_API_KEY"
   ```

3. **App Service 재시작**
   ```bash
   az webapp restart --name anyang-church-app --resource-group anyang-church-rg
   ```

#### 방법 2: 비디오 확인

1. **비디오가 공개되어 있는지 확인**
   - YouTube에서 직접 접근 가능한지 확인
   - 자막이 활성화되어 있는지 확인

2. **시간 구간 확인**
   - 시작 시간과 종료 시간이 올바른지 확인
   - 비디오 길이를 초과하지 않는지 확인

#### 방법 3: 로그 확인

Azure App Service 로그에서 상세한 오류 정보 확인:

```bash
az webapp log tail --name anyang-church-app --resource-group anyang-church-rg
```

### 자막 추출 우선순위

시스템은 다음 순서로 자막을 추출합니다:

1. **YouTube Data API** (API 키가 있는 경우)
   - 가장 안정적
   - 공식 API 사용
   - 할당량 제한 있음

2. **youtube-transcript 라이브러리**
   - API 키 불필요
   - 공개 자막만 가능

3. **STT (Speech-to-Text)**
   - 자막이 없는 경우
   - yt-dlp로 오디오 다운로드
   - Whisper 모델로 변환

### 예상 로그

#### 성공적인 자막 추출:
```
Trying YouTube Data API for captions...
Fetching captions list for video YSik-AHcFog using YouTube Data API...
Found 1 caption(s) for video YSik-AHcFog
Using Korean caption: ko
Downloading caption ...
Parsing SRT caption ...
✅ Successfully extracted 156 segments via YouTube Data API
```

#### 자막 없음 → STT:
```
Caption not available, trying STT...
Attempting to download audio for video YSik-AHcFog...
yt-dlp available: true
Trying yt-dlp for audio download...
✅ Audio downloaded via yt-dlp: /app/temp/YSik-AHcFog_xxx.mp3
Transcribing audio using Whisper...
✅ Transcription completed: 156 segments
```

### 일반적인 문제

#### 문제 1: "410 Gone" 에러
- **원인**: 비디오가 삭제되었거나 접근이 제한됨
- **해결**: YouTube Data API 키 설정 또는 다른 비디오 사용

#### 문제 2: "403 Forbidden" 에러
- **원인**: 지역 제한 또는 연령 제한
- **해결**: YouTube Data API 키 설정

#### 문제 3: 자막이 0개
- **원인**: 시간 구간이 잘못되었거나 자막이 없음
- **해결**: 시간 구간 확인, 전체 비디오로 시도

### 테스트

#### 1. 자막 추출 테스트
```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
    "startTime": "38:40",
    "endTime": "1:14:40"
  }'
```

#### 2. 전체 프로세스 테스트
```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/process" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
    "startTime": "38:40",
    "endTime": "1:14:40"
  }'
```

### 추가 도움말

- `YOUTUBE_API_SETUP.md`: YouTube Data API 설정 가이드
- `FIX_SUMMARY.md`: 최근 수정사항 요약
- Azure App Service 로그: 실시간 오류 확인
