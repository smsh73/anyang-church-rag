import express from 'express';
import { generatePodcastAudio, generateLongPodcastAudio } from '../services/podcastService.js';

const router = express.Router();

/**
 * POST /api/podcast/generate
 * Podcast 오디오 생성
 */
router.post('/generate', async (req, res) => {
  try {
    const { text, options } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const audio = await generatePodcastAudio(text, options || {});
    
    res.json({
      success: true,
      audioPath: audio.filePath,
      duration: audio.duration
    });
  } catch (error) {
    console.error('Podcast generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/podcast/generate-long
 * 긴 텍스트를 위한 Podcast 오디오 생성
 */
router.post('/generate-long', async (req, res) => {
  try {
    const { text, options } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const audioFiles = await generateLongPodcastAudio(text, options || {});
    
    res.json({
      success: true,
      audioFiles: audioFiles.map(a => ({
        filePath: a.filePath,
        duration: a.duration
      }))
    });
  } catch (error) {
    console.error('Long podcast generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
