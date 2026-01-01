import express from 'express';
import { correctTranscript } from '../services/correctionService.js';

const router = express.Router();

/**
 * POST /api/correct
 * AI 기반 자막 보정
 */
router.post('/', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Transcript array is required' });
    }
    
    const result = await correctTranscript(transcript);
    res.json(result);
  } catch (error) {
    console.error('Correction error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
