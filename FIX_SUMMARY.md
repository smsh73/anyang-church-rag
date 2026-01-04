# 오류 수정 요약

## 발견된 문제

### 1. YouTube 비디오 다운로드 실패
- **에러**: "YouTube 비디오를 다운로드할 수 없습니다. 비디오가 삭제되었거나 접근이 제한되었을 수 있습니다."
- **원인**: ytdl-core와 yt-dlp 모두 실패

### 2. PostgreSQL 초기화 실패
- **에러**: "extension \"vector\" is not allow-listed for \"azure_pg_admin\" users"
- **원인**: Azure PostgreSQL에서 pgvector 확장 활성화 제한

## 적용된 수정사항

### 1. YouTube Data API 지원 추가 ✅

**파일**: `utils/youtubeDataAPI.js` (신규)

- YouTube Data API v3를 사용한 자막 추출
- API 키가 있으면 우선 사용
- SRT 형식 자막 파싱
- 시간 구간 필터링 지원

**우선순위**:
1. YouTube Data API (API 키가 있는 경우)
2. youtube-transcript 라이브러리
3. STT (자막이 없는 경우)

### 2. yt-dlp 다운로드 로직 개선 ✅

**파일**: `utils/youtubeDownloaderYtdlp.js`

- 전체 오디오 다운로드 후 FFmpeg로 구간 추출
- `--download-sections` 대신 안정적인 방법 사용
- 에러 처리 개선
- 다양한 오디오 형식 지원

### 3. 데이터베이스 초기화 에러 처리 개선 ✅

**파일**: `config/database.js`

- pgvector 확장 활성화 실패 시에도 테이블 생성 계속
- Azure PostgreSQL 제한사항 인식
- 에러 메시지 개선

### 4. 자막 추출 로직 개선 ✅

**파일**: `services/youtubeService.js`

- YouTube Data API 우선 시도
- 여러 방법 순차 시도
- 더 나은 에러 메시지

## 사용 방법

### YouTube Data API 키 설정 (선택사항)

```bash
az webapp config appsettings set \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --settings YOUTUBE_API_KEY="YOUR_API_KEY"
```

### 테스트

```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/process" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=YSik-AHcFog",
    "startTime": "38:40",
    "endTime": "1:14:40"
  }'
```

## 예상 결과

### YouTube Data API 키가 있는 경우:
1. YouTube Data API로 자막 추출 시도
2. 성공 시 즉시 반환
3. 실패 시 youtube-transcript로 fallback

### API 키가 없는 경우:
1. youtube-transcript로 자막 추출 시도
2. 실패 시 STT 사용
3. yt-dlp로 오디오 다운로드
4. Whisper로 변환

## 다음 단계

1. **배포 대기**: GitHub Actions가 자동으로 배포 중 (5-10분)
2. **API 키 설정** (선택사항): YouTube Data API 키 설정
3. **테스트**: 위의 테스트 명령 실행
4. **확인**: 로그에서 어떤 방법이 사용되었는지 확인

## 참고 문서

- `YOUTUBE_API_SETUP.md`: YouTube Data API 설정 가이드
- `DB_FIX_GUIDE.md`: 데이터베이스 초기화 문제 해결 가이드
