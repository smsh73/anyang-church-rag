# Azure 데이터베이스 설정 가이드

## PostgreSQL 데이터베이스 설정

Azure App Service에서 PostgreSQL에 연결하려면 다음 중 하나를 선택하세요:

### 옵션 1: Azure Database for PostgreSQL (권장)

1. **Azure Database for PostgreSQL 생성**:
   ```bash
   az postgres flexible-server create \
     --resource-group anyang-church-rg \
     --name anyang-church-db \
     --location koreacentral \
     --admin-user postgres \
     --admin-password <your-password> \
     --sku-name Standard_B1ms \
     --tier Burstable \
     --version 15 \
     --storage-size 32 \
     --public-access 0.0.0.0
   ```

2. **방화벽 규칙 추가** (App Service IP 허용):
   ```bash
   az postgres flexible-server firewall-rule create \
     --resource-group anyang-church-rg \
     --name anyang-church-db \
     --rule-name AllowAppService \
     --start-ip-address 0.0.0.0 \
     --end-ip-address 255.255.255.255
   ```

3. **데이터베이스 생성**:
   ```bash
   az postgres flexible-server db create \
     --resource-group anyang-church-rg \
     --server-name anyang-church-db \
     --database-name anyang_church
   ```

4. **App Service에 환경 변수 설정**:
   ```bash
   az webapp config appsettings set \
     --resource-group anyang-church-rg \
     --name anyang-church-rag \
     --settings \
       DB_HOST=anyang-church-db.postgres.database.azure.com \
       DB_PORT=5432 \
       DB_NAME=anyang_church \
       DB_USER=postgres \
       DB_PASSWORD=<your-password> \
       DB_SSL=true
   ```

### 옵션 2: 연결 문자열 사용

```bash
az webapp config appsettings set \
  --resource-group anyang-church-rg \
  --name anyang-church-rag \
  --settings \
    DATABASE_URL=postgresql://postgres:password@host:5432/anyang_church?sslmode=require
```

### 옵션 3: 외부 PostgreSQL 서버

외부 PostgreSQL 서버를 사용하는 경우:

```bash
az webapp config appsettings set \
  --resource-group anyang-church-rg \
  --name anyang-church-rag \
  --settings \
    DB_HOST=your-postgres-host.com \
    DB_PORT=5432 \
    DB_NAME=anyang_church \
    DB_USER=postgres \
    DB_PASSWORD=your-password \
    DB_SSL=true
```

## 환경 변수 확인

설정한 환경 변수를 확인하려면:

```bash
az webapp config appsettings list \
  --resource-group anyang-church-rg \
  --name anyang-church-rag \
  --output table
```

## 데이터베이스 연결 테스트

애플리케이션이 시작되면 로그에서 다음을 확인하세요:

- ✅ `Database initialized successfully` - 성공
- ❌ `Database initialization error` - 실패 (환경 변수 확인 필요)

## 주의사항

1. **보안**: 프로덕션 환경에서는 Azure Key Vault를 사용하여 비밀번호를 관리하는 것을 권장합니다.

2. **SSL**: Azure Database for PostgreSQL은 SSL 연결을 요구합니다. `DB_SSL=true`를 설정하세요.

3. **방화벽**: App Service의 아웃바운드 IP를 PostgreSQL 방화벽에 추가해야 할 수 있습니다.

4. **연결 풀**: 많은 동시 연결이 필요한 경우 PostgreSQL의 `max_connections` 설정을 확인하세요.
