# 설정 가이드

## 1. GitHub 레포지토리 생성

GitHub에서 레포지토리를 먼저 생성해야 합니다:

1. https://github.com/smsh73 에 로그인
2. "New repository" 클릭
3. Repository name: `anyang-church-rag`
4. Description: "안양제일교회 YouTube RAG 시스템"
5. Public 또는 Private 선택
6. **README, .gitignore, license는 추가하지 않음** (이미 있음)
7. "Create repository" 클릭

## 2. 코드 푸시

레포지토리 생성 후 다음 명령 실행:

```bash
cd /Users/seungminlee/Downloads/AJAICHAT
git push -u origin main
```

## 3. Azure 리소스 생성

### Azure CLI 로그인

```bash
az login
```

### 리소스 생성 스크립트 실행

```bash
./azure-setup.sh
```

또는 수동으로:

```bash
# 리소스 그룹
az group create --name anyang-church-rg --location koreacentral

# ACR
az acr create --resource-group anyang-church-rg --name anyangchurchacr --sku Basic --admin-enabled true

# App Service Plan
az appservice plan create --name anyang-church-plan --resource-group anyang-church-rg --location koreacentral --is-linux --sku B1

# App Service
az webapp create --resource-group anyang-church-rg --plan anyang-church-plan --name anyang-church-rag --deployment-container-image-name anyangchurchacr.azurecr.io/anyang-church-rag:latest
```

## 4. GitHub Actions 설정

### Azure Service Principal 생성

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az ad sp create-for-rbac --name "github-actions-anyang-church" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/anyang-church-rg \
  --sdk-auth
```

출력된 JSON을 복사합니다.

### GitHub Secrets 설정

1. GitHub 레포지토리: https://github.com/smsh73/anyang-church-rag
2. Settings > Secrets and variables > Actions
3. "New repository secret" 클릭
4. Name: `AZURE_CREDENTIALS`
5. Value: 위에서 복사한 JSON 전체
6. "Add secret" 클릭

### ACR 권한 부여

```bash
SP_ID=$(az ad sp list --display-name "github-actions-anyang-church" --query [0].id -o tsv)
az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/anyang-church-rg/providers/Microsoft.ContainerRegistry/registries/anyangchurchacr
```

## 5. 환경 변수 설정 (Azure App Service)

```bash
az webapp config appsettings set \
  --resource-group anyang-church-rg \
  --name anyang-church-rag \
  --settings \
    WEBSITES_PORT=3000 \
    NODE_ENV=production \
    DB_HOST=your-db-host \
    DB_PORT=5432 \
    DB_NAME=anyang_church \
    DB_USER=postgres \
    DB_PASSWORD=your-password
```

## 6. 첫 배포

GitHub에 코드를 푸시하면 자동으로 배포됩니다:

```bash
git push origin main
```

또는 수동 배포:

```bash
# ACR 로그인
az acr login --name anyangchurchacr

# 이미지 빌드 및 푸시
docker build -t anyangchurchacr.azurecr.io/anyang-church-rag:latest .
docker push anyangchurchacr.azurecr.io/anyang-church-rag:latest

# App Service 재시작
az webapp restart --name anyang-church-rag --resource-group anyang-church-rg
```

## 7. 배포 확인

```bash
# Health check
curl https://anyang-church-rag.azurewebsites.net/health

# 로그 확인
az webapp log tail --name anyang-church-rag --resource-group anyang-church-rg
```

## 트러블슈팅

### 포트 오류
App Service는 `PORT` 환경 변수를 자동 설정합니다. 코드에서 `process.env.PORT`를 사용합니다.

### 데이터베이스 연결 오류
PostgreSQL 연결 정보를 환경 변수에 올바르게 설정했는지 확인하세요.

### ACR 인증 오류
Service Principal에 ACR 권한이 있는지 확인하세요.
