import express from 'express';
import { createIndex, indexDocuments } from '../services/indexService.js';

const router = express.Router();

/**
 * POST /api/index
 * 문서 인덱싱
 */
router.post('/', async (req, res) => {
  try {
    const { chunks } = req.body;
    
    if (!chunks || !Array.isArray(chunks)) {
      return res.status(400).json({ error: 'Chunks array is required' });
    }
    
    // 인덱스 생성 (없으면)
    try {
      await createIndex();
    } catch (error) {
      // 이미 존재하는 경우 무시
      console.log('Index may already exist:', error.message);
    }
    
    // 문서 인덱싱
    await indexDocuments(chunks);
    
    res.json({
      success: true,
      indexed: chunks.length
    });
  } catch (error) {
    console.error('Indexing error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
