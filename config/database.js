import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'anyang_church',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 테이블 초기화
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
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

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}
