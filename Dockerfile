FROM node:20-slim

WORKDIR /app

# 시스템 의존성 설치 (FFmpeg, yt-dlp 등)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp 설치 (ytdl-core 대안)
# --break-system-packages 플래그 사용 (Docker 환경에서는 안전)
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --omit=dev

# 애플리케이션 코드 복사
COPY . .

# temp 디렉토리 생성
RUN mkdir -p temp

# 포트 노출
EXPOSE 3000

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 애플리케이션 실행
CMD ["node", "server.js"]
