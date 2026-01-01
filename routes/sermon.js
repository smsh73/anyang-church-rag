import express from 'express';
import { searchSermonChunks } from '../services/sermonStorageService.js';
import { generateEmbeddings } from '../services/embeddingService.js';

const router = express.Router();

/**
 * POST /api/sermon/search
 * 설교 청크 검색 (PostgreSQL 벡터 검색)
 */
router.post('/search', async (req, res) => {
  try {
    const { query, serviceType, serviceDateFrom, serviceDateTo, videoId, top = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // 쿼리 임베딩 생성
    const queryEmbedding = await generateEmbeddings([{ fullText: query }]);
    
    // 벡터 검색
    const results = await searchSermonChunks(queryEmbedding[0].embedding, {
      serviceType,
      serviceDateFrom,
      serviceDateTo,
      videoId,
      top
    });
    
    res.json({
      success: true,
      query,
      results: results.map(r => ({
        id: r.chunk_id,
        chunkText: r.chunk_text,
        similarity: r.similarity,
        metadata: {
          videoId: r.video_id,
          preacher: r.preacher,
          sermon_topic: r.sermon_topic,
          bible_verse: r.bible_verse,
          serviceDate: r.service_date,
          keywords: r.keywords,
          videoTitle: r.video_title,
          serviceType: r.service_type
        }
      })),
      count: results.length
    });
  } catch (error) {
    console.error('Sermon search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
