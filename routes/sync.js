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
        connected: false,
        indexes: [],
        error: null
      },
      azureSearch: null
    };
    
    // PostgreSQL 연결 상태 확인
    try {
      const { pool } = await import('../config/database.js');
      const client = await pool.connect();
      
      // 연결 테스트
      await client.query('SELECT 1');
      
      // 인덱스 확인
      const indexResult = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename IN ('sermon_chunks', 'bible_verses', 'sermon_transcripts', 'ai_api_keys')
        AND indexname LIKE '%embedding%'
        ORDER BY indexname
      `);
      
      status.postgreSQL.connected = true;
      status.postgreSQL.indexes = indexResult.rows.map(row => row.indexname);
      
      // 테이블 존재 확인
      const tableResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('sermon_chunks', 'bible_verses', 'sermon_transcripts', 'ai_api_keys')
        ORDER BY table_name
      `);
      status.postgreSQL.tables = tableResult.rows.map(row => row.table_name);
      
      // 통계 정보
      const statsResult = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM sermon_chunks) as sermon_chunks_count,
          (SELECT COUNT(*) FROM bible_verses) as bible_verses_count,
          (SELECT COUNT(*) FROM sermon_transcripts) as transcripts_count,
          (SELECT COUNT(*) FROM ai_api_keys WHERE is_active = true) as active_api_keys_count
      `);
      status.postgreSQL.stats = statsResult.rows[0];
      
      client.release();
    } catch (dbError) {
      status.postgreSQL.connected = false;
      status.postgreSQL.error = dbError.message;
    }
    
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
