# PostgreSQL 데이터베이스 초기화 문제 해결 가이드

## 문제 상황

Azure Database for PostgreSQL에서 `pgvector` 확장을 활성화할 수 없어 데이터베이스 초기화가 실패하는 문제가 발생했습니다.

### 에러 메시지
```
extension "vector" is not allow-listed for "azure_pg_admin" users in Azure Database for PostgreSQL
relation "sermon_chunks" does not exist
```

## 해결 방법

### 1. 자동 해결 (권장)

코드가 수정되어 `pgvector` 확장 활성화 실패 시에도 테이블이 생성되도록 개선되었습니다.

**수정 사항**:
- `pgvector` 확장 활성화를 try-catch로 감싸서 실패해도 계속 진행
- 벡터 인덱스 생성도 try-catch로 감싸서 실패해도 테이블은 생성
- 에러 메시지에 "vector" 또는 "extension"이 포함되면 경고만 출력하고 계속 진행

### 2. 수동 데이터베이스 초기화

API를 통해 수동으로 데이터베이스를 초기화할 수 있습니다:

```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/db/init"
```

### 3. Azure Portal에서 pgvector 활성화

Azure Database for PostgreSQL에서 `pgvector` 확장을 활성화하려면:

1. Azure Portal → PostgreSQL 서버 선택
2. "Server parameters" 메뉴로 이동
3. `shared_preload_libraries` 파라미터에 `vector` 추가
4. 서버 재시작

또는 Azure CLI 사용:
```bash
az postgres flexible-server parameter set \
  --resource-group anyang-church-rg \
  --server-name YOUR_SERVER_NAME \
  --name shared_preload_libraries \
  --value vector

az postgres flexible-server restart \
  --resource-group anyang-church-rg \
  --server-name YOUR_SERVER_NAME
```

### 4. pgvector 없이 사용

`pgvector` 확장이 없어도 시스템은 정상 작동합니다:
- ✅ 모든 테이블 생성됨
- ✅ 데이터 저장 및 조회 가능
- ⚠️ 벡터 검색은 순차 스캔 사용 (느림)
- ⚠️ 벡터 인덱스 없음

## 현재 상태 확인

### API로 상태 확인
```bash
curl "https://anyang-church-app.azurewebsites.net/api/sync/status"
```

### 예상 응답 (수정 후)
```json
{
  "success": true,
  "status": {
    "postgreSQL": {
      "connected": true,
      "indexes": [],
      "tables": [
        "ai_api_keys",
        "bible_verses",
        "sermon_chunks",
        "sermon_transcripts"
      ],
      "stats": {
        "sermon_chunks_count": 0,
        "bible_verses_count": 0,
        "transcripts_count": 0,
        "active_api_keys_count": 0
      }
    }
  }
}
```

## 테이블 구조

### 생성되는 테이블

1. **ai_api_keys**: AI API 키 저장
2. **sermon_transcripts**: 설교 전체 텍스트
3. **sermon_chunks**: 설교 청크 (벡터 임베딩 포함)
4. **bible_verses**: 성경 구절 (벡터 임베딩 포함)

### 벡터 인덱스

`pgvector` 확장이 활성화되지 않으면:
- 벡터 인덱스는 생성되지 않음
- 벡터 검색은 순차 스캔 사용
- 기능은 정상 작동하지만 성능이 느림

## 다음 단계

1. **코드 배포 확인**: GitHub Actions가 완료되었는지 확인
2. **데이터베이스 초기화**: `/api/db/init` 엔드포인트 호출
3. **상태 확인**: `/api/sync/status` 엔드포인트로 확인
4. **pgvector 활성화** (선택사항): Azure Portal에서 활성화

## 문제 해결 체크리스트

- [ ] 코드가 배포되었는지 확인
- [ ] 데이터베이스 초기화 API 호출
- [ ] 테이블이 생성되었는지 확인
- [ ] pgvector 확장 활성화 (선택사항)
- [ ] 벡터 인덱스 생성 확인 (pgvector 활성화 후)
