import express from 'express';
import { searchBible, saveBibleVerse } from '../services/bibleRAGService.js';
import { generateEmbeddings } from '../services/embeddingService.js';

const router = express.Router();

/**
 * POST /api/bible/search
 * 성경 하이브리드 RAG 검색
 */
router.post('/search', async (req, res) => {
  try {
    const { query, testament, top } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await searchBible(query, {
      testament,
      top: top || 10
    });
    
    res.json({
      success: true,
      query,
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Bible search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/bible/verse
 * 성경 구절 저장
 */
router.post('/verse', async (req, res) => {
  try {
    const { book, chapter, verse, text, testament } = req.body;
    
    if (!book || !chapter || !verse || !text || !testament) {
      return res.status(400).json({ 
        error: 'book, chapter, verse, text, and testament are required' 
      });
    }
    
    await saveBibleVerse(book, chapter, verse, text, testament);
    
    res.json({ success: true, message: 'Bible verse saved' });
  } catch (error) {
    console.error('Save bible verse error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
