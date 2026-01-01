# Azure 배포 가이드

## 사전 요구사항

1. Azure CLI 설치
2. Azure 계정 로그인
3. GitHub Personal Access Token (GitHub Actions용)

## 1. Azure 리소스 생성

### 방법 1: 스크립트 사용 (권장)

```bash
# Azure 로그인
az login

# 스크립트 실행
./azure-setup.sh
```

### 방법 2: 수동 생성

```bash
# 리소스 그룹 생성
az group create --name anyang-church-rg --location koreacentral

# Azure Container Registry 생성
az acr create \
  --resource-group anyang-church-rg \
  --name anyangchurchacr \
  --sku Basic \
  --admin-enabled true

# App Service Plan 생성
az appservice plan create \
  --name anyang-church-plan \
  --resource-group anyang-church-rg \
  --location koreacentral \
  --is-linux \
  --sku B1

# App Service 생성
az webapp create \
  --resource-group anyang-church-rg \
  --plan anyang-church-plan \
  --name anyang-church-rag \
  --deployment-container-image-name anyangchurchacr.azurecr.io/anyang-church-rag:latest

# ACR 통합 설정
az webapp config container set \
  --name anyang-church-rag \
  --resource-group anyang-church-rg \
  --docker-custom-image-name anyangchurchacr.azurecr.io/anyang-church-rag:latest \
  --docker-registry-server-url https://anyangchurchacr.azurecr.io \
  --docker-registry-server-user $(az acr credential show --name anyangchurchacr --query username --output tsv) \
  --docker-registry-server-password $(az acr credential show --name anyangchurchacr --query passwords[0].value --output tsv)
```

## 2. GitHub Actions 설정

### Azure Service Principal 생성

```bash
# Service Principal 생성
az ad sp create-for-rbac --name "github-actions-anyang-church" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/anyang-church-rg \
  --sdk-auth
```

출력된 JSON을 GitHub Secrets에 `AZURE_CREDENTIALS`로 저장합니다.

### GitHub Secrets 설정

1. GitHub 레포지토리로 이동
2. Settings > Secrets and variables > Actions
3. 다음 Secrets 추가:
   - `AZURE_CREDENTIALS`: 위에서 생성한 Service Principal JSON

## 3. 환경 변수 설정 (Azure App Service)

```bash
az webapp config appsettings set \
  --resource-group anyang-church-rg \
  --name anyang-church-rag \
  --settings \
    DB_HOST=your-db-host \
    DB_PORT=5432 \
    DB_NAME=anyang_church \
    DB_USER=postgres \
    DB_PASSWORD=your-password \
    AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/ \
    AZURE_OPENAI_API_KEY=your-key \
    AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net \
    AZURE_SEARCH_API_KEY=your-key \
    NODE_ENV=production \
    WEBSITES_PORT=3000
```

## 4. 로컬에서 Docker 이미지 빌드 및 푸시

```bash
# ACR 로그인
az acr login --name anyangchurchacr

# 이미지 빌드
docker build -t anyangchurchacr.azurecr.io/anyang-church-rag:latest .

# 이미지 푸시
docker push anyangchurchacr.azurecr.io/anyang-church-rag:latest
```

## 5. 배포 확인

```bash
# App Service 로그 확인
az webapp log tail --name anyang-church-rag --resource-group anyang-church-rg

# Health check
curl https://anyang-church-rag.azurewebsites.net/health
```

## 트러블슈팅

### 포트 설정
App Service는 `PORT` 환경 변수를 자동으로 설정합니다. 코드에서 `process.env.PORT`를 사용하도록 되어 있습니다.

### 데이터베이스 연결
PostgreSQL은 별도로 설정해야 합니다. Azure Database for PostgreSQL을 사용하거나 외부 PostgreSQL을 사용할 수 있습니다.

### ACR 인증
GitHub Actions에서 ACR에 접근하려면 Service Principal에 ACR 권한이 필요합니다:

```bash
az role assignment create \
  --assignee <service-principal-id> \
  --role AcrPush \
  --scope /subscriptions/{subscription-id}/resourceGroups/anyang-church-rg/providers/Microsoft.ContainerRegistry/registries/anyangchurchacr
```
