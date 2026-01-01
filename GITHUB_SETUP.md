# GitHub 레포지토리 생성 및 푸시 가이드

## 1. GitHub 레포지토리 생성

다음 단계를 따라 GitHub에서 레포지토리를 생성하세요:

1. **GitHub 로그인**: https://github.com/smsh73 에 로그인
2. **새 레포지토리 생성**:
   - 우측 상단의 "+" 아이콘 클릭 > "New repository"
   - Repository name: `anyang-church-rag`
   - Description: "안양제일교회 YouTube RAG 시스템"
   - Public 또는 Private 선택
   - **중요**: "Add a README file", "Add .gitignore", "Choose a license"는 모두 **체크하지 않음** (이미 있음)
3. **"Create repository" 클릭**

## 2. 코드 푸시

레포지토리 생성 후 다음 명령을 실행하세요:

```bash
cd /Users/seungminlee/Downloads/AJAICHAT
git push -u origin main
```

## 3. GitHub Actions 자동 배포 설정

레포지토리 생성 후 다음 단계를 진행하세요:

### Azure Service Principal 생성

```bash
# Azure 로그인
az login

# 구독 ID 확인
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Service Principal 생성
az ad sp create-for-rbac --name "github-actions-anyang-church" \
  --role contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/anyang-church-rg \
  --sdk-auth
```

출력된 JSON을 복사하세요. 예시:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "..."
}
```

### GitHub Secrets 설정

1. GitHub 레포지토리로 이동: https://github.com/smsh73/anyang-church-rag
2. **Settings** > **Secrets and variables** > **Actions** 클릭
3. **"New repository secret"** 클릭
4. Name: `AZURE_CREDENTIALS`
5. Value: 위에서 복사한 JSON 전체를 붙여넣기
6. **"Add secret"** 클릭

### ACR 권한 부여

```bash
# Service Principal ID 확인
SP_ID=$(az ad sp list --display-name "github-actions-anyang-church" --query [0].id -o tsv)
echo "Service Principal ID: $SP_ID"

# ACR Push 권한 부여
az role assignment create \
  --assignee $SP_ID \
  --role AcrPush \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/anyang-church-rg/providers/Microsoft.ContainerRegistry/registries/anyangchurchacr
```

## 4. Azure 리소스 생성

레포지토리 생성 및 푸시 후 Azure 리소스를 생성하세요:

```bash
# Azure 로그인
az login

# 리소스 생성 스크립트 실행
cd /Users/seungminlee/Downloads/AJAICHAT
./azure-setup.sh
```

또는 수동으로:

```bash
# 리소스 그룹
az group create --name anyang-church-rg --location koreacentral

# Azure Container Registry
az acr create --resource-group anyang-church-rg --name anyangchurchacr --sku Basic --admin-enabled true

# App Service Plan
az appservice plan create --name anyang-church-plan --resource-group anyang-church-rg --location koreacentral --is-linux --sku B1

# App Service
az webapp create --resource-group anyang-church-rg --plan anyang-church-plan --name anyang-church-rag --deployment-container-image-name anyangchurchacr.azurecr.io/anyang-church-rag:latest

# ACR 통합
ACR_LOGIN_SERVER=$(az acr show --name anyangchurchacr --resource-group anyang-church-rg --query loginServer --output tsv)
az webapp config container set \
  --name anyang-church-rag \
  --resource-group anyang-church-rg \
  --docker-custom-image-name $ACR_LOGIN_SERVER/anyang-church-rag:latest \
  --docker-registry-server-url https://$ACR_LOGIN_SERVER \
  --docker-registry-server-user $(az acr credential show --name anyangchurchacr --query username --output tsv) \
  --docker-registry-server-password $(az acr credential show --name anyangchurchacr --query passwords[0].value --output tsv)
```

## 5. 환경 변수 설정

```bash
az webapp config appsettings set \
  --resource-group anyang-church-rg \
  --name anyang-church-rag \
  --settings \
    WEBSITES_PORT=3000 \
    NODE_ENV=production
```

데이터베이스 및 기타 API 키는 나중에 추가하세요.

## 6. 자동 배포 확인

GitHub에 코드를 푸시하면 자동으로 배포됩니다:

```bash
git push origin main
```

GitHub Actions 탭에서 배포 진행 상황을 확인할 수 있습니다:
https://github.com/smsh73/anyang-church-rag/actions

## 완료 확인

배포 완료 후:

```bash
# Health check
curl https://anyang-church-rag.azurewebsites.net/health

# API 확인
curl https://anyang-church-rag.azurewebsites.net/
```
