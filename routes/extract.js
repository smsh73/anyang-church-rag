import express from 'express';
import { extractTranscript } from '../services/youtubeService.js';

const router = express.Router();

/**
 * POST /api/extract
 * YouTube 구간 영상 자막 추출
 */
router.post('/', async (req, res) => {
  try {
    const { url, startTime, endTime } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const result = await extractTranscript(url, startTime, endTime);
    res.json(result);
  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
