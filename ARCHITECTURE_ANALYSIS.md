# Azure Frontend/Backend 구성 분석

## 현재 구조

### 아키텍처 타입
**모노리식 구조 (Monolithic Architecture)**
- 단일 Express 서버가 프론트엔드와 백엔드를 모두 처리
- 하나의 Docker 컨테이너로 배포
- Azure App Service 단일 인스턴스에서 실행

### 구조 다이어그램

```
┌─────────────────────────────────────────────┐
│      Azure App Service (Container)          │
│  Port: 3000                                  │
├─────────────────────────────────────────────┤
│  Express Server (server.js)                  │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │  Frontend (Static Files)              │  │
│  │  - public/index.html                  │  │
│  │  - public/app.js                      │  │
│  │  - public/styles.css                  │  │
│  │  → app.use(express.static('public'))  │  │
│  └──────────────────────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐  │
│  │  Backend API (REST API)               │  │
│  │  - /api/*                             │  │
│  │  - routes/*.js                        │  │
│  │  - services/*.js                       │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## 파일 구조 분석

### Frontend
```
public/
├── index.html      # 관리자 페이지 (HTML)
├── app.js          # 프론트엔드 로직 (JavaScript)
├── styles.css      # 스타일시트
└── README.md       # 프론트엔드 문서
```

**특징:**
- 순수 HTML/CSS/JavaScript (프레임워크 없음)
- `API_BASE_URL = window.location.origin` 사용
- 같은 서버의 `/api/*` 엔드포인트 호출

### Backend
```
server.js           # Express 서버 진입점
routes/             # API 라우트
├── extract.js      # POST /api/extract
├── correct.js      # POST /api/correct
├── process.js      # POST /api/process
├── search.js       # POST /api/search
├── aiKeys.js       # GET/POST/PUT/DELETE /api/ai-keys
├── bible.js        # POST /api/bible/*
├── podcast.js      # POST /api/podcast/*
├── image.js        # POST /api/image/*
├── sermon.js       # POST /api/sermon/*
└── sync.js         # POST/GET /api/sync/*

services/           # 비즈니스 로직
├── youtubeService.js
├── embeddingService.js
├── searchService.js
├── correctionService.js
└── ...

config/             # 설정
├── database.js
├── azureConfig.js
└── youtubeConfig.js
```

## Azure 배포 구성

### 현재 배포 방식
1. **GitHub Actions** → Docker 이미지 빌드
2. **Azure Container Registry (ACR)** → 이미지 저장
3. **Azure App Service** → 컨테이너 실행

### 배포 설정
- **App Service 이름**: `anyang-church-rag`
- **리소스 그룹**: `anyang-church-rg`
- **지역**: `koreacentral`
- **포트**: 3000 (내부)
- **외부 URL**: `https://anyang-church-app.azurewebsites.net`

### 라우팅 구조

```
https://anyang-church-app.azurewebsites.net/
├── /                    → index.html (프론트엔드)
├── /api/*               → Backend API
├── /health              → Health check
└── /static files        → public/* (자동 서빙)
```

## 구성 검증

### ✅ 올바른 구성

1. **정적 파일 서빙**
   ```javascript
   app.use(express.static('public'));
   ```
   - ✅ 올바름: `public` 디렉토리가 정적 파일로 서빙됨

2. **API 라우트**
   ```javascript
   app.use('/api/extract', extractRouter);
   app.use('/api/process', processRouter);
   // ...
   ```
   - ✅ 올바름: 모든 API가 `/api/*` 경로로 구성됨

3. **프론트엔드 API 호출**
   ```javascript
   const API_BASE_URL = window.location.origin;
   fetch(`${API_BASE_URL}/api/process`, ...)
   ```
   - ✅ 올바름: 같은 서버의 API를 호출

4. **루트 경로 처리**
   ```javascript
   app.get('/', (req, res) => {
     res.json({ ... }); // API 정보 반환
   });
   ```
   - ⚠️ 주의: 루트 경로가 JSON을 반환하지만, `express.static`이 먼저 처리되어 `index.html`이 서빙됨

### ⚠️ 잠재적 문제

1. **루트 경로 충돌 가능성**
   - `app.use(express.static('public'))`가 먼저 실행되므로
   - `app.get('/', ...)`는 실제로 실행되지 않을 수 있음
   - 하지만 `index.html`이 서빙되므로 문제 없음

2. **CORS 설정**
   - `app.use(cors())`로 모든 요청 허용
   - ✅ 모노리식 구조에서는 문제 없음 (같은 도메인)

3. **정적 파일 캐싱**
   - 현재 캐싱 헤더 설정 없음
   - 필요시 추가 가능

## 권장 사항

### 현재 구조 유지 (권장)
- ✅ 단순하고 관리하기 쉬움
- ✅ 배포가 간단함
- ✅ CORS 문제 없음
- ✅ 관리자 페이지로 충분함

### 개선 가능 사항

1. **정적 파일 캐싱 추가** (선택사항)
   ```javascript
   app.use(express.static('public', {
     maxAge: '1d',
     etag: true
   }));
   ```

2. **루트 경로 명확화** (선택사항)
   ```javascript
   // index.html을 명시적으로 서빙
   app.get('/', (req, res) => {
     res.sendFile(path.join(__dirname, 'public', 'index.html'));
   });
   ```

3. **에러 페이지 추가** (선택사항)
   ```javascript
   app.use((req, res) => {
     res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
   });
   ```

## 결론

### ✅ 구성이 올바릅니다

현재 Azure 배포 구성은 **모노리식 구조**로 올바르게 설정되어 있습니다:

1. **Frontend**: `public/` 디렉토리의 정적 파일
2. **Backend**: `/api/*` 경로의 REST API
3. **배포**: 단일 Docker 컨테이너로 Azure App Service에 배포
4. **라우팅**: Express가 정적 파일과 API를 모두 처리

### 확인 사항

- ✅ Frontend와 Backend가 같은 서버에서 실행
- ✅ API 호출이 올바른 경로 사용
- ✅ 정적 파일 서빙이 올바르게 설정됨
- ✅ CORS 설정이 적절함
- ✅ Azure 배포 설정이 올바름

### 추가 개선 (선택사항)

현재 구성으로도 충분히 작동하지만, 필요시 위의 개선 사항을 적용할 수 있습니다.
