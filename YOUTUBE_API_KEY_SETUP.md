# YouTube Data API 키 설정 가이드

## 개요

YouTube Data API 키를 관리자 페이지에서 등록하고 관리할 수 있습니다. API 키는 데이터베이스에 저장되며, 환경 변수보다 우선적으로 사용됩니다.

## 설정 방법

### 1. Google Cloud Console에서 API 키 생성

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com/ 접속
   - 프로젝트 선택 또는 새 프로젝트 생성

2. **YouTube Data API v3 활성화**
   - "API 및 서비스" > "라이브러리" 메뉴
   - "YouTube Data API v3" 검색
   - "사용 설정" 클릭

3. **API 키 생성**
   - "API 및 서비스" > "사용자 인증 정보" 메뉴
   - "사용자 인증 정보 만들기" > "API 키" 선택
   - API 키가 생성되면 복사

4. **API 키 제한 설정 (권장)**
   - 생성된 API 키 클릭
   - "애플리케이션 제한사항" 설정:
     - "HTTP 리퍼러(웹사이트)" 선택
     - 허용된 리퍼러에 `https://anyang-church-app.azurewebsites.net/*` 추가
   - "API 제한사항" 설정:
     - "키 제한" 선택
     - "YouTube Data API v3"만 선택

### 2. 관리자 페이지에서 API 키 등록

1. **관리자 페이지 접속**
   - https://anyang-church-app.azurewebsites.net 접속
   - "API 키 설정" 탭 클릭

2. **YouTube API 키 추가**
   - "새 API 키 추가" 버튼 클릭
   - 서비스: "YouTube Data API" 선택
   - 이름: (선택사항) 예: "main-youtube-key"
   - API 키: Google Cloud Console에서 복사한 키 입력
   - "저장" 클릭

3. **API 키 확인**
   - 등록된 API 키가 목록에 표시됨
   - 상태가 "활성"인지 확인

## 우선순위

YouTube API 키는 다음 순서로 사용됩니다:

1. **데이터베이스에 저장된 키** (우선)
   - 관리자 페이지에서 등록한 키
   - `ai_api_keys` 테이블의 `provider='youtube'` 레코드

2. **환경 변수** (fallback)
   - Azure App Service 환경 변수 `YOUTUBE_API_KEY`
   - 데이터베이스에 키가 없을 때만 사용

## API 키 관리

### 활성화/비활성화
- API 키 목록에서 "활성화" 또는 "비활성화" 버튼 클릭
- 비활성화된 키는 사용되지 않음

### 수정
- API 키를 수정하려면 삭제 후 새로 등록하거나
- 직접 데이터베이스에서 수정 가능

### 삭제
- API 키 목록에서 "삭제" 버튼 클릭
- 확인 후 삭제됨

## 여러 API 키 등록

여러 개의 YouTube API 키를 등록할 수 있습니다:
- 이름으로 구분 (예: "main-key", "backup-key")
- 가장 최근에 생성된 활성 키가 사용됨
- 키가 만료되거나 할당량 초과 시 다른 키로 교체 가능

## 확인 방법

### 1. 로그 확인
YouTube 비디오 처리 시 로그에서 확인:
```
Trying YouTube Data API for captions...
✅ Captions extracted via YouTube Data API: 150 segments
```

### 2. API 키 상태 확인
- 관리자 페이지 > "API 키 설정" 탭
- YouTube Data API 키의 상태 확인

## 문제 해결

### API 키가 작동하지 않는 경우

1. **API 키 확인**
   - Google Cloud Console에서 API 키가 활성화되어 있는지 확인
   - YouTube Data API v3가 활성화되어 있는지 확인

2. **할당량 확인**
   - Google Cloud Console > "할당량" 메뉴
   - 일일 할당량이 초과되지 않았는지 확인

3. **제한 설정 확인**
   - API 키 제한 설정이 너무 엄격한지 확인
   - 테스트 중에는 제한을 해제할 수 있음

4. **데이터베이스 확인**
   - API 키가 데이터베이스에 올바르게 저장되었는지 확인
   - `is_active = true`인지 확인

### 환경 변수와 충돌하는 경우

- 데이터베이스에 저장된 키가 우선적으로 사용됩니다
- 환경 변수는 데이터베이스에 키가 없을 때만 사용됩니다
- 환경 변수를 제거하거나 데이터베이스 키를 사용하는 것을 권장합니다

## 참고

- **할당량**: YouTube Data API는 일일 할당량이 있습니다 (기본 10,000 units/day)
- **비용**: 무료 할당량이 있지만, 초과 시 요금이 발생할 수 있습니다
- **보안**: API 키는 민감한 정보이므로 안전하게 관리하세요

## 관련 문서

- `YOUTUBE_DOWNLOAD_FIX.md`: YouTube 다운로드 오류 수정
- `YOUTUBE_API_SETUP.md`: YouTube API 설정 가이드 (이전 버전)
