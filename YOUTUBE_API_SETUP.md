# YouTube Data API 설정 가이드

## 개요

YouTube 비디오 처리를 개선하기 위해 YouTube Data API v3를 사용할 수 있습니다. API 키를 설정하면 더 안정적으로 자막을 가져올 수 있습니다.

## YouTube Data API 키 설정

### 1. Google Cloud Console에서 API 키 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. "API 및 서비스" > "라이브러리"로 이동
4. "YouTube Data API v3" 검색 및 활성화
5. "API 및 서비스" > "사용자 인증 정보"로 이동
6. "사용자 인증 정보 만들기" > "API 키" 선택
7. 생성된 API 키 복사

### 2. Azure App Service에 환경 변수 설정

```bash
az webapp config appsettings set \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --settings YOUTUBE_API_KEY="YOUR_API_KEY_HERE"
```

또는 Azure Portal에서:
1. App Service 선택
2. "구성" > "애플리케이션 설정"으로 이동
3. "새 애플리케이션 설정" 클릭
4. 이름: `YOUTUBE_API_KEY`, 값: API 키 입력
5. 저장

## 자막 추출 우선순위

YouTube Data API 키가 설정되면 다음 순서로 자막을 추출합니다:

1. **YouTube Data API** (API 키가 있는 경우)
   - 가장 안정적
   - 공식 API 사용
   - 할당량 제한 있음 (일일 10,000 단위)

2. **youtube-transcript 라이브러리**
   - API 키 불필요
   - 공개 자막만 가능

3. **STT (Speech-to-Text)**
   - 자막이 없는 경우
   - yt-dlp로 오디오 다운로드
   - Whisper 모델로 변환

## API 할당량

YouTube Data API v3는 일일 할당량이 있습니다:
- 기본 할당량: 10,000 단위/일
- captions.list: 50 단위
- captions.download: 50 단위

**참고**: API 키가 없어도 시스템은 정상 작동합니다. youtube-transcript 라이브러리와 STT를 사용합니다.

## 문제 해결

### API 키 오류
```
YouTube API quota exceeded or access denied
```
- API 할당량 초과 또는 권한 문제
- 다른 방법으로 자동 fallback

### 자막 없음
```
Video not found or captions not available
```
- 비디오에 자막이 없음
- STT로 자동 전환

## 테스트

### API 키 설정 확인
```bash
curl "https://anyang-church-app.azurewebsites.net/api/extract" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
    "startTime": "38:40",
    "endTime": "1:14:40"
  }'
```

### 예상 응답
```json
{
  "success": true,
  "videoId": "YSik-AHcFog",
  "method": "youtube-api",
  "transcript": [...]
}
```

## 비용

YouTube Data API v3는 무료입니다:
- 일일 10,000 단위 무료
- 추가 할당량은 유료

## 참고

- YouTube Data API 문서: https://developers.google.com/youtube/v3
- API 할당량: https://developers.google.com/youtube/v3/getting-started#quota
