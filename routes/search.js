import express from 'express';
import { hybridSearch, ragQuery } from '../services/searchService.js';

const router = express.Router();

/**
 * POST /api/search
 * 하이브리드 검색
 */
router.post('/', async (req, res) => {
  try {
    const { query, serviceType, serviceDateFrom, serviceDateTo, videoId, top = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await hybridSearch(query, {
      serviceType,
      serviceDateFrom,
      serviceDateTo,
      videoId,
      top
    });
    
    res.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/rag
 * RAG 질의응답
 */
router.post('/rag', async (req, res) => {
  try {
    const { query, serviceType, serviceDateFrom, serviceDateTo, videoId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const answer = await ragQuery(query, {
      serviceType,
      serviceDateFrom,
      serviceDateTo,
      videoId
    });
    
    res.json({
      success: true,
      query,
      answer
    });
  } catch (error) {
    console.error('RAG query error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
