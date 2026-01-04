# 데이터베이스 초기화 문제 해결

## 문제

PostgreSQL에서 `sermon_chunks` 테이블이 생성되지 않는 문제가 발생했습니다.

### 원인
- Azure PostgreSQL에서 `pgvector` 확장을 활성화할 수 없음
- `VECTOR(768)` 타입을 사용하는 테이블 생성이 실패
- 초기화가 중단되어 일부 테이블만 생성됨

## 해결 방법

### 수정 내용

1. **pgvector 확장 확인 로직 추가**
   - 확장이 활성화되어 있는지 먼저 확인
   - 활성화 여부에 따라 embedding 컬럼 타입 결정

2. **조건부 컬럼 타입**
   - pgvector 있음: `VECTOR(768)`
   - pgvector 없음: `TEXT` (JSON 문자열로 저장)

3. **벡터 인덱스 조건부 생성**
   - pgvector가 있을 때만 벡터 인덱스 생성
   - 없으면 스킵하고 경고 메시지 출력

### 코드 변경

```javascript
// pgvector 확장 확인
let vectorExtensionAvailable = false;
try {
  const extCheck = await client.query(`
    SELECT EXISTS(
      SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) as exists
  `);
  vectorExtensionAvailable = extCheck.rows[0]?.exists || false;
} catch (e) {
  vectorExtensionAvailable = false;
}

// embedding 컬럼 타입 결정
const embeddingType = vectorExtensionAvailable ? 'VECTOR(768)' : 'TEXT';

// 테이블 생성 (조건부 타입 사용)
await client.query(`
  CREATE TABLE IF NOT EXISTS sermon_chunks (
    ...
    embedding ${embeddingType},
    ...
  )
`);
```

## 적용 방법

### 1. 배포 대기
- GitHub Actions가 자동으로 배포 중 (약 5-10분)

### 2. 데이터베이스 초기화
배포 완료 후:

```bash
curl -X POST "https://anyang-church-app.azurewebsites.net/api/db/init"
```

### 3. 상태 확인
```bash
curl "https://anyang-church-app.azurewebsites.net/api/sync/status"
```

## 예상 결과

### 성공 시:
```json
{
  "postgreSQL": {
    "connected": true,
    "tables": [
      "ai_api_keys",
      "bible_verses",
      "sermon_chunks",
      "sermon_transcripts"
    ],
    "indexes": []
  }
}
```

### 참고
- pgvector가 없어도 모든 테이블이 생성됩니다
- embedding은 JSON 문자열로 저장됩니다
- 벡터 검색은 순차 스캔을 사용합니다 (느리지만 작동함)
