import express from 'express';
import {
  saveApiKey,
  getApiKey,
  getAllApiKeys,
  updateApiKey,
  deleteApiKey
} from '../services/aiKeyManager.js';

const router = express.Router();

/**
 * GET /api/ai-keys
 * 모든 AI API 키 조회
 */
router.get('/', async (req, res) => {
  try {
    const keys = await getAllApiKeys();
    res.json({ success: true, keys });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai-keys
 * AI API 키 저장
 */
router.post('/', async (req, res) => {
  try {
    const { provider, apiKey, name } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key are required' });
    }
    
    const validProviders = ['openai', 'claude', 'gemini', 'perplexity', 'elevenlabs', 'nanobanana'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` });
    }
    
    const key = await saveApiKey(provider, apiKey, name);
    res.json({ success: true, key });
  } catch (error) {
    console.error('Save API key error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/ai-keys/:id
 * AI API 키 수정
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const key = await updateApiKey(parseInt(id), updates);
    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json({ success: true, key });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/ai-keys/:id
 * AI API 키 삭제
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const key = await deleteApiKey(parseInt(id));
    
    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
