# 자막 없는 YouTube 비디오 처리 개선 사항

## 개선 내용

### 1. Whisper STT 처리 개선

**파일**: `utils/whisperSTT.js`

#### 변경 사항:
- 타임스탬프 처리 개선
- 청크 단위 처리 옵션 추가 (`chunk_length_s: 30`, `stride_length_s: 5`)
- 에러 핸들링 강화
- 로깅 추가

#### 개선된 기능:
```javascript
const result = await model(audioPath, {
  language: language,
  return_timestamps: true,
  chunk_length_s: 30,  // 30초 청크로 처리
  stride_length_s: 5   // 5초 오버랩
});
```

### 2. yt-dlp 대안 추가

**파일**: `utils/youtubeDownloaderYtdlp.js` (신규)

#### 기능:
- Python yt-dlp를 child_process로 실행
- ytdl-core 실패 시 자동 fallback
- 시간 구간 직접 추출 지원
- MP3 형식 자동 변환

#### 사용 방법:
```javascript
import { downloadAudioWithYtdlp, checkYtdlpAvailable } from './youtubeDownloaderYtdlp.js';

// yt-dlp 사용 가능 여부 확인
const check = await checkYtdlpAvailable();
if (check.available) {
  const audioPath = await downloadAudioWithYtdlp(videoId, startTime, endTime);
}
```

### 3. 다중 다운로드 방법 지원

**파일**: `utils/youtubeDownloader.js`

#### 우선순위:
1. **yt-dlp** (가장 안정적, 우선 시도)
2. **ytdl-core** (기본 방법)
3. **@distube/ytdl-core** (ytdl-core 실패 시)
4. **yt-dlp 재시도** (모든 방법 실패 시)

#### Fallback 로직:
```javascript
// 1. yt-dlp 우선 시도
if (ytdlpCheck.available) {
  try {
    return await downloadAudioWithYtdlp(videoId, startTime, endTime);
  } catch (error) {
    // ytdl-core로 fallback
  }
}

// 2. ytdl-core 시도
try {
  stream = ytdl(videoUrl, options);
} catch (error) {
  // @distube/ytdl-core로 fallback
  stream = ytdlDistube(videoUrl, options);
}

// 3. 스트림 에러 시 yt-dlp 재시도
stream.on('error', (err) => {
  if (ytdlpCheck.available) {
    downloadAudioWithYtdlp(videoId, startTime, endTime)
      .then(resolve)
      .catch(reject);
  }
});
```

### 4. Dockerfile 업데이트

**파일**: `Dockerfile`

#### 추가된 의존성:
- `python3-pip`: Python 패키지 관리
- `yt-dlp`: Python 기반 YouTube 다운로더

#### 설치 명령:
```dockerfile
RUN pip3 install --no-cache-dir yt-dlp
```

### 5. package.json 업데이트

**추가된 패키지**:
- `@distube/ytdl-core`: ytdl-core의 대안

## 사용 방법

### 자동 Fallback

시스템이 자동으로 다음 순서로 시도합니다:

1. **yt-dlp** (설치되어 있으면)
2. **ytdl-core**
3. **@distube/ytdl-core**
4. **yt-dlp 재시도** (에러 발생 시)

### 수동 확인

```javascript
import { checkYtdlpAvailable } from './utils/youtubeDownloaderYtdlp.js';

const check = await checkYtdlpAvailable();
console.log('yt-dlp available:', check.available);
if (check.available) {
  console.log('Version:', check.version);
}
```

## 테스트

### 자막 없는 비디오 테스트

```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=VIDEO_ID",
    "startTime": "0:00",
    "endTime": "1:00"
  }'
```

### 예상 동작:
1. 자막 확인 시도
2. 자막 없음 감지
3. yt-dlp로 오디오 다운로드 시도
4. yt-dlp 실패 시 ytdl-core로 fallback
5. 오디오 다운로드 성공
6. Whisper STT로 변환
7. 타임스탬프와 함께 텍스트 반환

## 에러 처리

### 일반적인 에러:
- **410 Gone**: 비디오 삭제/제한
- **403 Forbidden**: 지역/연령 제한
- **404 Not Found**: 비디오 없음

### Fallback 동작:
- ytdl-core 실패 → @distube/ytdl-core 시도
- 모든 ytdl 방법 실패 → yt-dlp 시도
- yt-dlp도 실패 → 에러 반환

## 성능

### 다운로드 속도:
- **yt-dlp**: 가장 빠르고 안정적
- **ytdl-core**: 중간 속도
- **@distube/ytdl-core**: ytdl-core와 유사

### STT 처리:
- **CPU**: 1분 오디오당 1-2분
- **GPU**: 훨씬 빠름 (수십 초)

## 제한사항

1. **yt-dlp 설치 필요**: Docker 이미지에 포함됨
2. **Python3 필요**: yt-dlp 실행을 위해
3. **디스크 공간**: 오디오 파일 임시 저장
4. **메모리**: 긴 오디오는 메모리 부족 가능

## 향후 개선 사항

1. **GPU 가속**: Whisper STT 속도 향상
2. **청크 단위 처리**: 긴 오디오를 여러 청크로 나누어 처리
3. **캐싱**: 다운로드한 오디오 파일 캐싱
4. **병렬 처리**: 여러 비디오 동시 처리
