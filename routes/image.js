import express from 'express';
import { generateImageWithNanoBanana } from '../services/imageService.js';

const router = express.Router();

/**
 * POST /api/image/generate
 * 이미지 생성 (Nano Banana Pro)
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt, options } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const result = await generateImageWithNanoBanana(prompt, options || {});
    
    res.json({
      success: true,
      images: result.images,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
