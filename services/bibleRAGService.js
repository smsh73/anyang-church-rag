import { pool } from '../config/database.js';
import { getApiKey } from './aiKeyManager.js';
import OpenAI from 'openai';

/**
 * 성경 구절 임베딩 생성
 */
async function generateBibleEmbedding(text) {
  const apiKeyData = await getApiKey('openai');
  if (!apiKeyData) {
    throw new Error('OpenAI API key not found');
  }

  const openai = new OpenAI({
    apiKey: apiKeyData.api_key
  });

  // text-embedding-ada-002 사용 (768차원)
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text
  });

  return response.data[0].embedding;
}

/**
 * 성경 구절 저장
 */
export async function saveBibleVerse(book, chapter, verse, text, testament) {
  const client = await pool.connect();
  try {
    const embedding = await generateBibleEmbedding(text);
    
    await client.query(
      `INSERT INTO bible_verses (book, chapter, verse, text, embedding, testament)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (book, chapter, verse) 
       DO UPDATE SET text = $4, embedding = $5, testament = $6`,
      [book, chapter, verse, text, JSON.stringify(embedding), testament]
    );
  } finally {
    client.release();
  }
}

/**
 * 성경 하이브리드 RAG 검색
 */
export async function searchBible(query, options = {}) {
  const client = await pool.connect();
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await generateBibleEmbedding(query);
    
    // 벡터 유사도 검색
    const vectorResults = await client.query(
      `SELECT book, chapter, verse, text, testament,
              1 - (embedding <=> $1::vector) as similarity
       FROM bible_verses
       WHERE testament = ANY($2::text[])
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [
        JSON.stringify(queryEmbedding),
        options.testament ? [options.testament] : ['구약', '신약'],
        options.top || 10
      ]
    );

    // 키워드 검색 (BM25 스타일)
    const keywordResults = await client.query(
      `SELECT book, chapter, verse, text, testament,
              ts_rank(to_tsvector('korean', text), plainto_tsquery('korean', $1)) as rank
       FROM bible_verses
       WHERE text ILIKE $2
         AND testament = ANY($3::text[])
       ORDER BY rank DESC
       LIMIT $4`,
      [
        query,
        `%${query}%`,
        options.testament ? [options.testament] : ['구약', '신약'],
        options.top || 10
      ]
    );

    // 결과 병합 (Reciprocal Rank Fusion)
    const combinedResults = combineSearchResults(
      vectorResults.rows,
      keywordResults.rows,
      options.top || 10
    );

    return combinedResults;
  } finally {
    client.release();
  }
}

/**
 * 검색 결과 병합 (RRF)
 */
function combineSearchResults(vectorResults, keywordResults, top) {
  const scoreMap = new Map();

  // 벡터 검색 결과 점수 계산
  vectorResults.forEach((result, index) => {
    const id = `${result.book}-${result.chapter}-${result.verse}`;
    const rrfScore = 1 / (60 + index + 1); // RRF 공식
    scoreMap.set(id, {
      ...result,
      vectorScore: result.similarity,
      keywordScore: 0,
      rrfScore: scoreMap.get(id)?.rrfScore || 0 + rrfScore
    });
  });

  // 키워드 검색 결과 점수 계산
  keywordResults.forEach((result, index) => {
    const id = `${result.book}-${result.chapter}-${result.verse}`;
    const rrfScore = 1 / (60 + index + 1);
    const existing = scoreMap.get(id);
    if (existing) {
      existing.keywordScore = result.rank;
      existing.rrfScore += rrfScore;
    } else {
      scoreMap.set(id, {
        ...result,
        vectorScore: 0,
        keywordScore: result.rank,
        rrfScore
      });
    }
  });

  // RRF 점수로 정렬
  const sortedResults = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, top);

  return sortedResults;
}
