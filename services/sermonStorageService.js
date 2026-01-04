import { pool } from '../config/database.js';

/**
 * 설교 청크 저장
 */
export async function saveSermonChunk(chunk, embedding) {
  let client;
  try {
    client = await pool.connect();
    await client.query(
      `INSERT INTO sermon_chunks (
        chunk_id, video_id, chunk_text, full_text, embedding,
        chunk_index, start_char, end_char, start_time, end_time,
        preacher, sermon_topic, bible_verse, service_date, keywords,
        video_title, service_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (chunk_id) 
      DO UPDATE SET
        chunk_text = $3,
        full_text = $4,
        embedding = $5,
        preacher = $11,
        sermon_topic = $12,
        bible_verse = $13,
        service_date = $14,
        keywords = $15,
        updated_at = CURRENT_TIMESTAMP`,
      [
        chunk.id,
        chunk.metadata.videoId,
        chunk.chunkText,
        chunk.fullText,
        JSON.stringify(embedding),
        chunk.metadata.chunkIndex,
        chunk.metadata.startChar,
        chunk.metadata.endChar,
        chunk.metadata.startTime,
        chunk.metadata.endTime,
        chunk.metadata.preacher,
        chunk.metadata.sermon_topic,
        chunk.metadata.bible_verse,
        chunk.metadata.service_date,
        chunk.metadata.keywords,
        chunk.metadata.videoTitle,
        chunk.metadata.service_type
      ]
    );
  } catch (error) {
    console.error('Save sermon chunk error:', error);
    throw new Error(`Failed to save sermon chunk: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * 설교 청크 검색 (벡터 유사도)
 */
export async function searchSermonChunks(queryEmbedding, options = {}) {
  let client;
  try {
    client = await pool.connect();
    const top = options.top || 5;
    
    const result = await client.query(
      `SELECT chunk_id, video_id, chunk_text, full_text, chunk_index,
              preacher, sermon_topic, bible_verse, service_date, keywords,
              video_title, service_type,
              1 - (embedding <=> $1::vector) as similarity
       FROM sermon_chunks
       WHERE ($2::text IS NULL OR service_type = $2)
         AND ($3::date IS NULL OR service_date >= $3)
         AND ($4::date IS NULL OR service_date <= $4)
         AND ($5::text IS NULL OR video_id = $5)
       ORDER BY embedding <=> $1::vector
       LIMIT $6`,
      [
        JSON.stringify(queryEmbedding),
        options.serviceType || null,
        options.serviceDateFrom || null,
        options.serviceDateTo || null,
        options.videoId || null,
        top
      ]
    );

    return result.rows;
  } catch (error) {
    console.error('Search sermon chunks error:', error);
    throw new Error(`Failed to search sermon chunks: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * 설교 전체 텍스트 저장 (문단으로 이어 붙인 원문)
 */
export async function saveSermonTranscript(videoId, fullText, metadata = {}) {
  let client;
  try {
    client = await pool.connect();
    
    // 문단 수 계산 (빈 줄로 구분된 문단)
    const paragraphs = fullText.split(/\n\s*\n/).filter(p => p.trim());
    const totalParagraphs = paragraphs.length;
    const totalCharacters = fullText.length;
    
    await client.query(
      `INSERT INTO sermon_transcripts (
        video_id, full_text, preacher, sermon_topic, bible_verse,
        service_date, service_type, video_title, keywords,
        total_paragraphs, total_characters
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (video_id) 
      DO UPDATE SET
        full_text = $2,
        preacher = $3,
        sermon_topic = $4,
        bible_verse = $5,
        service_date = $6,
        service_type = $7,
        video_title = $8,
        keywords = $9,
        total_paragraphs = $10,
        total_characters = $11,
        updated_at = CURRENT_TIMESTAMP`,
      [
        videoId,
        fullText,
        metadata.preacher || null,
        metadata.sermon_topic || null,
        metadata.bible_verse || null,
        metadata.service_date || null,
        metadata.service_type || null,
        metadata.videoTitle || metadata.video_title || null,
        metadata.keywords || null,
        totalParagraphs,
        totalCharacters
      ]
    );
    
    console.log(`✅ Saved full transcript for video: ${videoId} (${totalParagraphs} paragraphs, ${totalCharacters} characters)`);
  } catch (error) {
    console.error('Save sermon transcript error:', error);
    throw new Error(`Failed to save sermon transcript: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * 설교 전체 텍스트 조회
 */
export async function getSermonTranscript(videoId) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT * FROM sermon_transcripts WHERE video_id = $1`,
      [videoId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Get sermon transcript error:', error);
    throw new Error(`Failed to get sermon transcript: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * PostgreSQL 벡터 인덱스 동기화 (REINDEX)
 */
export async function syncPostgreSQLIndex() {
  let client;
  try {
    client = await pool.connect();
    console.log('Synchronizing PostgreSQL indexes...');
    
    // 인덱스 존재 여부 확인 후 재구성
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE indexname IN ('sermon_chunks_embedding_idx', 'bible_verses_embedding_idx')
    `);
    
    const existingIndexes = indexCheck.rows.map(row => row.indexname);
    
    // 벡터 인덱스 재구성 (존재하는 경우만)
    for (const indexName of ['sermon_chunks_embedding_idx', 'bible_verses_embedding_idx']) {
      if (existingIndexes.includes(indexName)) {
        try {
          // CONCURRENTLY는 트랜잭션 내에서 사용할 수 없으므로 일반 REINDEX 사용
          await client.query(`REINDEX INDEX ${indexName}`);
          console.log(`✅ Reindexed ${indexName}`);
        } catch (reindexError) {
          console.warn(`⚠️  Failed to reindex ${indexName}:`, reindexError.message);
        }
      } else {
        console.log(`ℹ️  Index ${indexName} does not exist (skipping)`);
      }
    }
    
    // 통계 정보 업데이트 (테이블이 존재하는 경우만)
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('sermon_chunks', 'bible_verses', 'sermon_transcripts')
    `);
    
    const existingTables = tableCheck.rows.map(row => row.table_name);
    
    for (const tableName of ['sermon_chunks', 'bible_verses', 'sermon_transcripts']) {
      if (existingTables.includes(tableName)) {
        try {
          await client.query(`ANALYZE ${tableName}`);
          console.log(`✅ Analyzed ${tableName}`);
        } catch (analyzeError) {
          console.warn(`⚠️  Failed to analyze ${tableName}:`, analyzeError.message);
        }
      }
    }
    
    console.log('PostgreSQL indexes synchronized successfully');
    return { 
      success: true, 
      message: 'PostgreSQL indexes synchronized',
      indexesReindexed: existingIndexes.length,
      tablesAnalyzed: existingTables.length
    };
  } catch (error) {
    console.warn('PostgreSQL index sync warning:', error.message);
    // 동기화 실패해도 계속 진행
    return { success: false, error: error.message };
  } finally {
    if (client) {
      client.release();
    }
  }
}
