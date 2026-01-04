# YouTube 다운로드 오류 수정

## 문제점

1. **410 Gone 오류**: ytdl-core가 YouTube 비디오 다운로드 실패
2. **yt-dlp fallback 미작동**: 스트림 에러 발생 시 yt-dlp 재시도가 제대로 작동하지 않음
3. **URL 파싱 오류**: 일부 YouTube URL 형식에서 비디오 ID 추출 실패

## 수정 사항

### 1. YouTube Data API 우선 사용

**파일**: `services/youtubeService.js`

- YouTube Data API를 더 적극적으로 사용하도록 개선
- API 키가 있으면 우선적으로 시도
- API 실패 시에도 다른 방법 시도 (에러를 throw하지 않음)

```javascript
// 방법 1: YouTube Data API를 사용한 자막 추출 (API 키가 있는 경우)
if (process.env.YOUTUBE_API_KEY) {
  console.log('Trying YouTube Data API for captions...');
  try {
    const apiTranscript = await extractCaptionsWithAPI(videoId, startSeconds, endSeconds);
    if (apiTranscript && apiTranscript.length > 0) {
      // 성공 시 즉시 반환
      return { success: true, ... };
    }
  } catch (apiError) {
    console.warn('YouTube Data API failed:', apiError.message);
    // API 실패해도 다른 방법 시도
  }
}
```

### 2. yt-dlp 우선순위 향상

**파일**: `services/youtubeService.js`

- yt-dlp를 가장 먼저 시도 (가장 안정적)
- ytdl-core 실패 시 yt-dlp 재시도 로직 추가

```javascript
// 1. yt-dlp 우선 시도 (가장 안정적)
if (ytdlpCheck.available) {
  try {
    audioPath = await downloadAudioWithYtdlp(videoId, startSeconds, endSeconds);
    downloadMethod = 'yt-dlp';
  } catch (ytdlpError) {
    // ytdl-core로 fallback
  }
}

// 2. ytdl-core 시도
if (!audioPath) {
  try {
    audioPath = await downloadAudio(videoId, startSeconds, endSeconds);
  } catch (ytdlError) {
    // 3. ytdl-core 실패 시 yt-dlp 재시도
    if (ytdlpCheck.available) {
      audioPath = await downloadAudioWithYtdlp(videoId, startSeconds, endSeconds);
    }
  }
}
```

### 3. 스트림 에러 핸들링 개선

**파일**: `utils/youtubeDownloader.js`

- 스트림 에러 핸들링을 async/await로 변경
- yt-dlp fallback이 제대로 작동하도록 수정

```javascript
// 스트림 에러 핸들링 (비동기 처리)
stream.on('error', async (err) => {
  streamError = err;
  // ... 에러 메시지 생성 ...
  
  // yt-dlp로 재시도 (비동기 처리)
  try {
    const ytdlpCheck = await checkYtdlpAvailable();
    if (ytdlpCheck.available) {
      const ytdlpPath = await downloadAudioWithYtdlp(videoId, startTime, endTime);
      resolve(ytdlpPath);
      return;
    }
  } catch (error) {
    reject(new Error(errorMessage));
  }
});
```

### 4. URL 파싱 개선

**파일**: `utils/youtubeDownloader.js`

- 다양한 YouTube URL 형식 지원
- 더 명확한 에러 메시지

```javascript
export function extractVideoId(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid YouTube URL: URL is required');
  }
  
  const normalizedUrl = url.trim();
  
  const patterns = [
    // 표준 YouTube URL
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    // 짧은 URL
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    // 직접 비디오 ID (11자리)
    /^([a-zA-Z0-9_-]{11})$/,
    // URL에 포함된 비디오 ID
    /[?&]v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1] && match[1].length === 11) {
      return match[1];
    }
  }
  
  throw new Error(`Invalid YouTube URL: Could not extract video ID from "${normalizedUrl}"`);
}
```

## 다운로드 우선순위

1. **YouTube Data API** (자막 추출)
   - 가장 안정적
   - API 키 필요
   - 자막이 있는 비디오에만 작동

2. **youtube-transcript 라이브러리** (자막 추출)
   - API 키 불필요
   - 자막이 있는 비디오에만 작동

3. **yt-dlp** (오디오 다운로드 + STT)
   - 가장 안정적인 다운로드 방법
   - 자막 없는 비디오에도 작동
   - Docker 이미지에 포함됨

4. **ytdl-core** (오디오 다운로드 + STT)
   - 기본 다운로드 방법
   - 일부 비디오에서 410/403 오류 발생 가능

5. **@distube/ytdl-core** (오디오 다운로드 + STT)
   - ytdl-core의 대안
   - ytdl-core 실패 시 시도

## 해결 방법

### 즉시 해결

1. **YouTube Data API 키 설정** (권장)
   - Azure App Service 환경 변수에 `YOUTUBE_API_KEY` 설정
   - Google Cloud Console에서 API 키 생성
   - YouTube Data API v3 활성화

2. **yt-dlp 확인**
   - Docker 이미지에 yt-dlp가 포함되어 있는지 확인
   - 로그에서 "yt-dlp available: true" 확인

### 장기 해결

1. **YouTube Data API 사용**
   - 자막 추출에 가장 안정적
   - API 키 설정 필요

2. **yt-dlp 우선 사용**
   - 오디오 다운로드에 가장 안정적
   - Docker 이미지에 포함됨

## 테스트

### 자막 있는 비디오
```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/process" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "startTime": "38:40",
    "endTime": "1:14:40"
  }'
```

### 자막 없는 비디오
- yt-dlp로 오디오 다운로드
- Whisper STT로 변환

## 예상 동작

1. YouTube Data API 시도 (API 키가 있는 경우)
2. youtube-transcript 라이브러리 시도
3. 자막 없음 감지
4. yt-dlp로 오디오 다운로드 시도
5. yt-dlp 실패 시 ytdl-core 시도
6. ytdl-core 실패 시 yt-dlp 재시도
7. 오디오 다운로드 성공
8. Whisper STT로 변환

## 참고

- `YOUTUBE_API_SETUP.md`: YouTube Data API 설정 가이드
- `STT_IMPROVEMENTS.md`: STT 처리 개선 사항
- `TROUBLESHOOTING.md`: 문제 해결 가이드
