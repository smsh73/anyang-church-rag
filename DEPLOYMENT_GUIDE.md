# 배포 가이드

## 자동 배포 (GitHub Actions)

### 설정 완료
- GitHub Actions 워크플로우: `.github/workflows/deploy.yml`
- main 브랜치에 푸시 시 자동 빌드 및 배포

### 배포 프로세스
1. 코드 커밋 및 푸시
   ```bash
   git add -A
   git commit -m "Your commit message"
   git push origin main
   ```

2. GitHub Actions 자동 실행
   - 코드 푸시 시 자동으로 워크플로우 시작
   - Docker 이미지 빌드
   - ACR에 푸시
   - Azure App Service에 배포

3. 수동 트리거 (선택사항)
   - GitHub 웹사이트에서 Actions 탭으로 이동
   - "Build and Deploy to Azure" 워크플로우 선택
   - "Run workflow" 버튼 클릭

## 수동 배포 (로컬 Docker)

### 사전 요구사항
- Docker 설치 및 실행 중
- Azure CLI 설치 및 로그인
- ACR 접근 권한

### 배포 단계

1. **Azure Container Registry 로그인**
   ```bash
   az acr login --name anyangchurchacr
   ```

2. **Docker 이미지 빌드**
   ```bash
   docker build -t anyang-church-rag:latest .
   ```

3. **이미지 태그 지정**
   ```bash
   docker tag anyang-church-rag:latest \
              anyangchurchacr.azurecr.io/anyang-church-rag:latest
   ```

4. **ACR에 푸시**
   ```bash
   docker push anyangchurchacr.azurecr.io/anyang-church-rag:latest
   ```

5. **Azure App Service 업데이트** (선택사항)
   ```bash
   az webapp restart --name anyang-church-app \
                     --resource-group anyang-church-rg
   ```

## 현재 상태

### ACR 정보
- **이름**: `anyangchurchacr`
- **로그인 서버**: `anyangchurchacr.azurecr.io`
- **리소스 그룹**: `anyang-church-rg`
- **지역**: `koreacentral`

### App Service 정보
- **이름**: `anyang-church-app`
- **리소스 그룹**: `anyang-church-rg`
- **URL**: `https://anyang-church-app.azurewebsites.net`

## 이미지 태그 전략

### GitHub Actions
- `${{ github.sha }}`: 커밋 해시 태그
- `latest`: 최신 버전 태그

### 수동 배포
- `latest`: 최신 버전
- 커밋 해시 또는 버전 번호 사용 권장

## 문제 해결

### Docker가 실행되지 않음
```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### ACR 로그인 실패
```bash
# 토큰 방식 로그인
az acr login -n anyangchurchacr --expose-token
```

### 이미지 푸시 실패
- ACR 권한 확인
- 네트워크 연결 확인
- 이미지 크기 확인 (너무 크면 빌드 최적화 필요)

## 모니터링

### GitHub Actions 상태
- GitHub 저장소 → Actions 탭
- 워크플로우 실행 상태 확인

### ACR 이미지 확인
```bash
az acr repository list --name anyangchurchacr --output table
az acr repository show-tags --name anyangchurchacr \
                            --repository anyang-church-rag \
                            --output table
```

### App Service 로그
```bash
az webapp log tail --name anyang-church-app \
                   --resource-group anyang-church-rg
```

## 최신 변경사항

### STT 개선사항
- 자막 없는 비디오 처리 지원
- yt-dlp fallback 추가
- Whisper STT 개선
- 다중 다운로드 방법 지원

### Dockerfile 업데이트
- yt-dlp 설치 추가
- Python3-pip 추가
- FFmpeg 포함

## 다음 단계

1. **코드 푸시**: `git push origin main`
2. **자동 빌드**: GitHub Actions가 자동으로 실행
3. **배포 확인**: App Service 로그 확인
4. **테스트**: API 엔드포인트 테스트
