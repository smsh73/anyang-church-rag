import { pool } from '../config/database.js';

/**
 * 설교 청크 저장
 */
export async function saveSermonChunk(chunk, embedding) {
  const client = await pool.connect();
  try {
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
  } finally {
    client.release();
  }
}

/**
 * 설교 청크 검색 (벡터 유사도)
 */
export async function searchSermonChunks(queryEmbedding, options = {}) {
  const client = await pool.connect();
  try {
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
  } finally {
    client.release();
  }
}
