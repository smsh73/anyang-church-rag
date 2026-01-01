#!/bin/bash

# Azure 리소스 생성 스크립트

RESOURCE_GROUP="anyang-church-rg"
LOCATION="koreacentral"
ACR_NAME="anyangchurchacr"
APP_SERVICE_PLAN="anyang-church-plan"
APP_SERVICE_NAME="anyang-church-rag"
SKU="B1"  # Basic 플랜

echo "Azure 리소스 생성 시작..."

# 리소스 그룹 생성
echo "리소스 그룹 생성 중..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Azure Container Registry 생성
echo "Azure Container Registry 생성 중..."
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# ACR 로그인 서버 확인
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)
echo "ACR 로그인 서버: $ACR_LOGIN_SERVER"

# App Service Plan 생성
echo "App Service Plan 생성 중..."
az appservice plan create \
  --name $APP_SERVICE_PLAN \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku $SKU

# App Service 생성 (컨테이너 기반)
echo "App Service 생성 중..."
az webapp create \
  --resource-group $RESOURCE_GROUP \
  --plan $APP_SERVICE_PLAN \
  --name $APP_SERVICE_NAME \
  --deployment-container-image-name $ACR_LOGIN_SERVER/anyang-church-rag:latest

# ACR에서 이미지 가져오기 설정
echo "ACR 통합 설정 중..."
az webapp config container set \
  --name $APP_SERVICE_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_LOGIN_SERVER/anyang-church-rag:latest \
  --docker-registry-server-url https://$ACR_LOGIN_SERVER \
  --docker-registry-server-user $(az acr credential show --name $ACR_NAME --query username --output tsv) \
  --docker-registry-server-password $(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# 환경 변수 설정 (필요시)
echo "환경 변수 설정 중..."
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --settings \
    WEBSITES_PORT=3000 \
    NODE_ENV=production

# 항상 켜기 설정
az webapp config set \
  --resource-group $RESOURCE_GROUP \
  --name $APP_SERVICE_NAME \
  --always-on true

echo "리소스 생성 완료!"
echo "ACR 이름: $ACR_NAME"
echo "App Service 이름: $APP_SERVICE_NAME"
echo "App Service URL: https://$APP_SERVICE_NAME.azurewebsites.net"
