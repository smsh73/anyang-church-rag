# Azure 설정 완료 가이드

## 완료된 작업

### 1. PostgreSQL 데이터베이스
- ✅ 서버: `anyang-church-db.postgres.database.azure.com`
- ✅ 데이터베이스: `anyang_church`
- ✅ 사용자: `postgres`
- ✅ 방화벽 규칙: 모든 Azure 서비스에서 접근 가능

### 2. App Service
- ✅ 이름: `anyang-church-app`
- ✅ URL: `https://anyang-church-app.azurewebsites.net`
- ✅ ACR 연결: `anyangchurchacr.azurecr.io`
- ✅ 환경 변수 설정:
  - `PORT=3000`
  - `DB_HOST=anyang-church-db.postgres.database.azure.com`
  - `DB_PORT=5432`
  - `DB_NAME=anyang_church`
  - `DB_USER=postgres`
  - `DB_SSL=true`

## 필수 설정 작업

### PostgreSQL 비밀번호 설정

PostgreSQL 관리자 비밀번호를 App Service 환경 변수에 설정해야 합니다.

#### 방법 1: Azure Portal 사용
1. [Azure Portal](https://portal.azure.com)에 로그인
2. `anyang-church-app` App Service로 이동
3. 설정 > 구성 > 애플리케이션 설정
4. `DB_PASSWORD` 환경 변수 추가
5. PostgreSQL 서버의 관리자 비밀번호 입력
6. 저장

#### 방법 2: Azure CLI 사용

PostgreSQL 비밀번호를 재설정하는 경우:
```bash
az postgres flexible-server update \
  --resource-group anyang-church-rg \
  --name anyang-church-db \
  --admin-password 'YOUR_SECURE_PASSWORD'
```

App Service에 비밀번호 설정:
```bash
az webapp config appsettings set \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --settings DB_PASSWORD='YOUR_SECURE_PASSWORD'
```

### Azure OpenAI 설정 (선택사항)

RAG 검색 및 AI 기능을 사용하려면 다음 환경 변수를 설정하세요:

```bash
az webapp config appsettings set \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --settings \
    AZURE_OPENAI_ENDPOINT='https://YOUR_OPENAI_RESOURCE.openai.azure.com' \
    AZURE_OPENAI_API_KEY='YOUR_API_KEY' \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT='text-embedding-ada-002' \
    AZURE_OPENAI_GPT_DEPLOYMENT='gpt-4'
```

### Azure AI Search 설정 (선택사항)

하이브리드 검색을 사용하려면 다음 환경 변수를 설정하세요:

```bash
az webapp config appsettings set \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --settings \
    AZURE_SEARCH_ENDPOINT='https://YOUR_SEARCH_SERVICE.search.windows.net' \
    AZURE_SEARCH_API_KEY='YOUR_SEARCH_API_KEY' \
    AZURE_SEARCH_INDEX_NAME='anyang-church-transcripts'
```

## 배포 확인

### App Service 로그 확인
```bash
az webapp log tail --name anyang-church-app --resource-group anyang-church-rg
```

### 애플리케이션 상태 확인
브라우저에서 다음 URL을 열어 확인하세요:
- 프론트엔드: `https://anyang-church-app.azurewebsites.net`
- API 상태: `https://anyang-church-app.azurewebsites.net/api/health` (있는 경우)

## 다음 단계

1. ✅ PostgreSQL 비밀번호 설정
2. ✅ Azure OpenAI 환경 변수 설정 (선택)
3. ✅ Azure AI Search 환경 변수 설정 (선택)
4. ✅ App Service 로그 확인하여 정상 작동 확인
5. ✅ 프론트엔드에서 벡터 임베딩 테스트

## 문제 해결

### 데이터베이스 연결 오류
- `DB_PASSWORD` 환경 변수가 올바르게 설정되었는지 확인
- PostgreSQL 방화벽 규칙이 올바르게 설정되었는지 확인
- App Service 로그에서 구체적인 오류 메시지 확인

### Docker 이미지 배포 오류
- ACR에 이미지가 푸시되었는지 확인: `az acr repository list --name anyangchurchacr`
- GitHub Actions 워크플로우가 성공적으로 완료되었는지 확인

### 환경 변수 확인
```bash
az webapp config appsettings list \
  --name anyang-church-app \
  --resource-group anyang-church-rg \
  --output table
```
