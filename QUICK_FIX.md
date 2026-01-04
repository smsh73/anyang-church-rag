# 빠른 문제 해결 가이드

## 현재 오류: YouTube 비디오 다운로드 실패

### 즉시 해결 방법

#### 1. YouTube Data API 키 설정 (가장 권장)

YouTube Data API를 사용하면 자막을 직접 가져올 수 있어 더 안정적입니다.

**단계:**
1. https://console.cloud.google.com/ 접속
2. 프로젝트 선택 또는 생성
3. "API 및 서비스" > "라이브러리"
4. "YouTube Data API v3" 검색 및 활성화
5. "API 및 서비스" > "사용자 인증 정보" > "API 키" 생성
6. Azure App Service에 환경 변수 추가:

```bash
az webapp config appsettings set \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --settings YOUTUBE_API_KEY="YOUR_API_KEY_HERE"
```

7. App Service 재시작:

```bash
az webapp restart --name anyang-church-app --resource-group anyang-church-rg
```

#### 2. 비디오 확인

- 비디오가 공개되어 있는지 확인
- 자막이 활성화되어 있는지 확인
- 시간 구간이 올바른지 확인 (38:40 ~ 1:14:40)

#### 3. 로그 확인

실시간 로그를 확인하여 정확한 오류 원인 파악:

```bash
az webapp log tail --name anyang-church-app --resource-group anyang-church-rg
```

### 현재 구현된 기능

✅ **YouTube Data API 지원** (API 키가 있으면 우선 사용)
✅ **youtube-transcript 라이브러리** (API 키 없어도 작동)
✅ **STT (Speech-to-Text)** (자막이 없는 경우)
✅ **yt-dlp fallback** (ytdl-core 실패 시)
✅ **상세한 에러 로깅**

### 예상 동작

#### YouTube Data API 키가 있는 경우:
1. YouTube Data API로 자막 추출 시도
2. 성공 시 즉시 반환
3. 실패 시 youtube-transcript로 fallback

#### API 키가 없는 경우:
1. youtube-transcript로 자막 추출 시도
2. 실패 시 STT 사용
3. yt-dlp로 오디오 다운로드
4. Whisper로 변환

### 테스트

배포 완료 후 (약 5-10분) 다시 시도:

```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/process" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
    "startTime": "38:40",
    "endTime": "1:14:40"
  }'
```

### 참고 문서

- `YOUTUBE_API_SETUP.md`: YouTube Data API 설정 가이드
- `TROUBLESHOOTING.md`: 상세한 문제 해결 가이드
- `FIX_SUMMARY.md`: 최근 수정사항 요약
