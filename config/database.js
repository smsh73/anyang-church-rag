import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL 연결 설정
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'anyang_church',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Azure에서 연결 시간 증가
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// 연결 문자열이 있으면 우선 사용 (Azure Database for PostgreSQL 등)
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  dbConfig.host = url.hostname;
  dbConfig.port = parseInt(url.port || '5432');
  dbConfig.database = url.pathname.slice(1);
  dbConfig.user = url.username;
  dbConfig.password = url.password;
  dbConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(dbConfig);

// 테이블 초기화
export async function initializeDatabase() {
  // 데이터베이스 연결 정보 확인
  if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
    console.warn('⚠️  Database configuration not found. Database features will be disabled.');
    console.warn('   Please set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD or DATABASE_URL environment variables.');
    return;
  }

  let client;
  try {
    client = await pool.connect();
    // pgvector 확장 활성화
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    // AI API 키 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_api_keys (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        api_key TEXT NOT NULL,
        name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, name)
      )
    `);

    // 설교 전체 텍스트 테이블 (문단으로 이어 붙인 원문)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sermon_transcripts (
        id SERIAL PRIMARY KEY,
        video_id VARCHAR(255) NOT NULL,
        full_text TEXT NOT NULL,
        -- 메타데이터
        preacher VARCHAR(255),
        sermon_topic VARCHAR(500),
        bible_verse TEXT,
        service_date DATE,
        service_type VARCHAR(100),
        video_title VARCHAR(500),
        keywords TEXT[],
        -- 통계
        total_paragraphs INTEGER,
        total_characters INTEGER,
        -- 타임스탬프
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(video_id)
      )
    `);

    // 설교 전체 텍스트 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS sermon_transcripts_video_id_idx 
      ON sermon_transcripts (video_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS sermon_transcripts_service_date_idx 
      ON sermon_transcripts (service_date)
    `);

    // 설교 청크 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS sermon_chunks (
        id SERIAL PRIMARY KEY,
        chunk_id VARCHAR(255) UNIQUE NOT NULL,
        video_id VARCHAR(255) NOT NULL,
        chunk_text TEXT NOT NULL,
        full_text TEXT NOT NULL,
        embedding VECTOR(768),
        chunk_index INTEGER NOT NULL,
        start_char INTEGER,
        end_char INTEGER,
        start_time INTEGER,
        end_time INTEGER,
        -- 메타데이터
        preacher VARCHAR(255),
        sermon_topic VARCHAR(500),
        bible_verse TEXT,
        service_date DATE,
        keywords TEXT[],
        video_title VARCHAR(500),
        service_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 벡터 검색을 위한 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS sermon_chunks_embedding_idx 
      ON sermon_chunks 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);

    // 성경 구절 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS bible_verses (
        id SERIAL PRIMARY KEY,
        book VARCHAR(100) NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding VECTOR(768),
        testament VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(book, chapter, verse)
      )
    `);

    // 성경 벡터 인덱스
    await client.query(`
      CREATE INDEX IF NOT EXISTS bible_verses_embedding_idx 
      ON bible_verses 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    console.error('   Connection details:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      ssl: !!dbConfig.ssl
    });
    // 데이터베이스 초기화 실패해도 서버는 계속 실행
    console.warn('⚠️  Server will continue without database. Some features may be unavailable.');
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}
