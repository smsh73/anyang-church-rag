# YouTube 구간 스크립트 STT 생성 방식 상세 설명

## 개요

YouTube 비디오에서 특정 구간의 오디오를 추출하여 Speech-to-Text(STT)로 텍스트를 생성하는 전체 프로세스를 설명합니다.

## 전체 프로세스 흐름

```
YouTube URL 입력
    ↓
비디오 ID 추출
    ↓
자막 확인 (우선 시도)
    ↓
[자막 있음] → 자막 사용
[자막 없음] → STT 프로세스 시작
    ↓
오디오 다운로드 (ytdl-core)
    ↓
FFmpeg로 구간 추출 및 변환
    ↓
Whisper 모델로 STT 변환
    ↓
타임스탬프와 함께 텍스트 반환
```

## 단계별 상세 설명

### 1. 비디오 ID 추출

**파일**: `utils/youtubeDownloader.js`

```javascript
export function extractVideoId(url) {
  // 지원하는 URL 형식:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - 직접 비디오 ID
}
```

**예시**:
- 입력: `https://www.youtube.com/watch?v=YSik-AHcFog&list=...`
- 출력: `YSik-AHcFog`

### 2. 시간 구간 파싱

**파일**: `utils/timeParser.js`

지원하는 시간 형식:
- `"38:40"` → 38분 40초 = 2320초
- `"1:14:40"` → 1시간 14분 40초 = 4480초
- `"38분40초"` → 한국어 형식
- `"2320"` → 직접 초 단위

**예시**:
```javascript
parseTimeToSeconds("38:40")     // → 2320초
parseTimeToSeconds("1:14:40")   // → 4480초
```

### 3. 자막 확인 (우선 시도)

**파일**: `services/youtubeService.js`

```javascript
// 먼저 자막이 있는지 확인
try {
  const transcriptList = await YoutubeTranscript.fetchTranscript(videoId);
  // 자막이 있으면 자막 사용 (더 빠르고 정확)
  method = 'caption';
} catch (error) {
  // 자막이 없으면 STT 사용
  method = 'stt';
}
```

**자막이 있는 경우**:
- 즉시 사용 (다운로드 불필요)
- 시간 구간 필터링만 수행
- 더 빠르고 정확함

**자막이 없는 경우**:
- STT 프로세스로 전환

### 4. 오디오 다운로드

**파일**: `utils/youtubeDownloader.js`

#### 4.1 ytdl-core로 오디오 스트림 생성

```javascript
const stream = ytdl(videoUrl, {
  quality: 'highestaudio',  // 최고 품질 오디오
  filter: 'audioonly',      // 오디오만 추출
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0...'  // 브라우저처럼 위장
    }
  }
});
```

**특징**:
- 비디오 전체를 다운로드하지 않고 스트리밍
- 오디오만 추출하여 용량 절약
- User-Agent 헤더로 일부 제한 우회 시도

#### 4.2 FFmpeg로 구간 추출 및 변환

```javascript
let ffmpegCommand = ffmpeg(stream)
  .audioCodec('libmp3lame')  // MP3 코덱
  .format('mp3');             // MP3 형식

// 시작 시간 설정
if (startTime !== null) {
  ffmpegCommand = ffmpegCommand.setStartTime(startTime);
}

// 종료 시간 설정 (duration 계산)
if (endTime !== null && startTime !== null) {
  const duration = endTime - startTime;
  ffmpegCommand = ffmpegCommand.setDuration(duration);
}
```

**예시**:
- 시작: 38:40 (2320초)
- 종료: 1:14:40 (4480초)
- duration: 2160초 (36분)

**결과**: 
- 전체 비디오가 아닌 36분 구간만 추출
- MP3 형식으로 변환
- 임시 파일로 저장 (`temp/VIDEO_ID_TIMESTAMP.mp3`)

### 5. Whisper STT 변환

**파일**: `utils/whisperSTT.js`

#### 5.1 Whisper 모델 초기화

```javascript
transcriber = await pipeline(
  'automatic-speech-recognition',
  'Xenova/whisper-small',  // 경량 모델
  { device: 'cpu' }         // CPU 사용 (GPU도 가능)
);
```

**사용 모델**: `Xenova/whisper-small`
- OpenAI Whisper의 경량 버전
- CPU에서도 실행 가능
- 한국어 지원
- 타임스탬프 제공

#### 5.2 오디오 → 텍스트 변환

```javascript
const result = await model(audioPath, {
  language: 'ko',              // 한국어 지정
  return_timestamps: true       // 타임스탬프 포함
});
```

**입력**: MP3 파일 경로
**출력**: 
```javascript
{
  text: "전체 텍스트...",
  chunks: [
    {
      text: "첫 번째 문장",
      timestamp: [0.0, 3.5]  // 시작, 종료 시간 (초)
    },
    {
      text: "두 번째 문장",
      timestamp: [3.5, 7.2]
    }
  ]
}
```

#### 5.3 표준 형식으로 변환

```javascript
const transcript = [];
for (const chunk of result.chunks) {
  transcript.push({
    text: chunk.text,
    offset: Math.floor(chunk.timestamp[0] * 1000),  // 밀리초
    duration: Math.floor((chunk.timestamp[1] - chunk.timestamp[0]) * 1000)
  });
}
```

**최종 출력 형식**:
```javascript
[
  {
    text: "안녕하세요",
    offset: 0,        // 시작 시간 (밀리초)
    duration: 2000    // 지속 시간 (밀리초)
  },
  {
    text: "오늘은 좋은 날씨네요",
    offset: 2000,
    duration: 3500
  }
]
```

### 6. 임시 파일 정리

```javascript
// STT 완료 후 임시 오디오 파일 삭제
if (audioPath) {
  await cleanupTempFile(audioPath);
}
```

**목적**: 디스크 공간 절약

## 전체 코드 흐름 예시

### 입력
```javascript
{
  url: "https://www.youtube.com/watch?v=YSik-AHcFog",
  startTime: "38:40",
  endTime: "1:14:40"
}
```

### 처리 과정

1. **비디오 ID 추출**: `YSik-AHcFog`
2. **시간 변환**: 
   - startTime: 2320초
   - endTime: 4480초
3. **자막 확인**: 없음 → STT 사용
4. **오디오 다운로드**:
   - ytdl-core로 스트림 생성
   - FFmpeg로 2320초~4480초 구간 추출
   - `temp/YSik-AHcFog_1234567890.mp3` 저장
5. **STT 변환**:
   - Whisper 모델로 오디오 분석
   - 한국어 텍스트 + 타임스탬프 생성
6. **임시 파일 삭제**: `temp/YSik-AHcFog_1234567890.mp3` 삭제

### 출력
```javascript
{
  success: true,
  videoId: "YSik-AHcFog",
  method: "stt",
  startTime: 2320,
  endTime: 4480,
  transcript: [
    {
      text: "오늘은 주일예배입니다",
      offset: 0,
      duration: 2500
    },
    {
      text: "말씀을 읽겠습니다",
      offset: 2500,
      duration: 2000
    }
    // ... 더 많은 세그먼트
  ]
}
```

## 기술 스택

### 1. ytdl-core
- **용도**: YouTube 비디오/오디오 다운로드
- **특징**: 스트리밍 방식, 오디오만 추출 가능
- **제한**: YouTube 정책 변경에 따라 일부 비디오 다운로드 불가 (410, 403 에러)

### 2. FFmpeg
- **용도**: 오디오 구간 추출 및 형식 변환
- **기능**: 
  - 시작 시간 지정 (`setStartTime`)
  - 지속 시간 지정 (`setDuration`)
  - 코덱 변환 (`libmp3lame`)
  - 형식 변환 (MP3)

### 3. @xenova/transformers (Whisper)
- **용도**: Speech-to-Text 변환
- **모델**: `Xenova/whisper-small`
- **특징**:
  - CPU에서 실행 가능
  - 한국어 지원
  - 타임스탬프 제공
  - 오프라인 실행 (모델 다운로드 필요)

## 성능 및 제한사항

### 성능
- **오디오 다운로드**: 비디오 길이에 비례 (스트리밍 속도)
- **FFmpeg 변환**: 매우 빠름 (수 초)
- **Whisper STT**: 
  - CPU: 약 1분 오디오당 1-2분
  - GPU: 훨씬 빠름 (수십 초)

### 제한사항
1. **YouTube 다운로드 제한**
   - 410 Gone: 비디오 삭제/제한
   - 403 Forbidden: 지역/연령 제한
   - 해결: 자막 사용 (가능한 경우)

2. **Whisper 모델 크기**
   - `whisper-small`: 약 500MB
   - 첫 실행 시 자동 다운로드
   - 디스크 공간 필요

3. **메모리 사용**
   - 오디오 파일 크기에 비례
   - 긴 구간은 메모리 부족 가능

## 개선 가능한 부분

### 1. 모델 선택
```javascript
// 현재: whisper-small (경량)
// 개선: whisper-medium 또는 whisper-large (더 정확)
transcriber = await pipeline(
  'automatic-speech-recognition',
  'Xenova/whisper-medium',  // 또는 whisper-large
  { device: 'cpu' }
);
```

### 2. GPU 가속
```javascript
// GPU 사용 시 훨씬 빠름
{ device: 'cuda' }  // NVIDIA GPU
```

### 3. 청크 단위 처리
```javascript
// 긴 오디오를 여러 청크로 나누어 처리
// 메모리 사용량 감소
```

### 4. 대안 라이브러리
- **yt-dlp**: ytdl-core의 포크, 더 안정적
- **OpenAI Whisper API**: 클라우드 서비스, 더 정확하지만 유료

## 실제 사용 예시

### API 호출
```bash
POST /api/process
{
  "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
  "startTime": "38:40",
  "endTime": "1:14:40"
}
```

### 로그 출력
```
Step 1: Extracting transcript...
Caption not available, using STT...
Downloading audio for video YSik-AHcFog...
Audio downloaded: /app/temp/YSik-AHcFog_1234567890.mp3
Transcribing audio...
Transcription completed: 156 segments
```

### 결과
- 36분 구간의 오디오를 텍스트로 변환
- 156개의 세그먼트 (평균 14초당 1개)
- 타임스탬프와 함께 반환

## 요약

YouTube 구간 스크립트 STT 생성은 다음 단계로 이루어집니다:

1. **자막 우선 확인** (빠르고 정확)
2. **자막 없으면 STT**:
   - ytdl-core로 오디오 스트림 다운로드
   - FFmpeg로 특정 구간만 추출
   - Whisper 모델로 오디오를 텍스트로 변환
   - 타임스탬프와 함께 반환

이 방식으로 자막이 없는 YouTube 비디오도 텍스트로 변환할 수 있습니다.
