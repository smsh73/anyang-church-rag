import express from 'express';
import { syncAndDeployIndex, getIndexStatus } from '../services/indexService.js';
import { syncPostgreSQLIndex } from '../services/sermonStorageService.js';

const router = express.Router();

/**
 * POST /api/sync
 * 인덱스 동기화 및 배포
 */
router.post('/', async (req, res) => {
  try {
    const { target } = req.body; // 'postgresql', 'azure', 'all'
    
    const results = {
      postgreSQL: null,
      azureSearch: null
    };
    
    // PostgreSQL 인덱스 동기화
    if (!target || target === 'postgresql' || target === 'all') {
      try {
        results.postgreSQL = await syncPostgreSQLIndex();
      } catch (error) {
        results.postgreSQL = { success: false, error: error.message };
      }
    }
    
    // Azure AI Search 인덱스 동기화 및 배포
    if (!target || target === 'azure' || target === 'all') {
      if (!process.env.AZURE_SEARCH_ENDPOINT || !process.env.AZURE_SEARCH_API_KEY) {
        results.azureSearch = { 
          success: false, 
          error: 'Azure Search is not configured. Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY environment variables.' 
        };
      } else {
        try {
          results.azureSearch = await syncAndDeployIndex();
        } catch (error) {
          results.azureSearch = { success: false, error: error.message };
        }
      }
    }
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sync/status
 * 인덱스 상태 확인
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      postgreSQL: {
        connected: true,
        indexes: ['sermon_chunks_embedding_idx', 'bible_verses_embedding_idx']
      },
      azureSearch: null
    };
    
    // Azure AI Search 상태 확인
    if (!process.env.AZURE_SEARCH_ENDPOINT || !process.env.AZURE_SEARCH_API_KEY) {
      status.azureSearch = { 
        error: 'Azure Search is not configured. Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_API_KEY environment variables.' 
      };
    } else {
      try {
        status.azureSearch = await getIndexStatus();
      } catch (error) {
        status.azureSearch = { error: error.message };
      }
    }
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
