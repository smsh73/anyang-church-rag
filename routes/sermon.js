import express from 'express';
import { searchSermonChunks, getSermonTranscript } from '../services/sermonStorageService.js';
import { generateEmbeddings } from '../services/embeddingService.js';

const router = express.Router();

/**
 * GET /api/sermon/transcript/:videoId
 * 설교 전체 텍스트 조회 (문단으로 이어 붙인 원문)
 */
router.get('/transcript/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    const transcript = await getSermonTranscript(videoId);
    
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    res.json({
      success: true,
      videoId: transcript.video_id,
      fullText: transcript.full_text,
      metadata: {
        preacher: transcript.preacher,
        sermon_topic: transcript.sermon_topic,
        bible_verse: transcript.bible_verse,
        serviceDate: transcript.service_date,
        serviceType: transcript.service_type,
        videoTitle: transcript.video_title,
        keywords: transcript.keywords
      },
      stats: {
        totalParagraphs: transcript.total_paragraphs,
        totalCharacters: transcript.total_characters
      },
      createdAt: transcript.created_at,
      updatedAt: transcript.updated_at
    });
  } catch (error) {
    console.error('Get sermon transcript error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
