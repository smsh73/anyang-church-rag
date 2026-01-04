import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import extractRouter from './routes/extract.js';
import correctRouter from './routes/correct.js';
import processRouter from './routes/process.js';
import indexRouter from './routes/index.js';
import searchRouter from './routes/search.js';
import aiKeysRouter from './routes/aiKeys.js';
import bibleRouter from './routes/bible.js';
import podcastRouter from './routes/podcast.js';
import imageRouter from './routes/image.js';
import sermonRouter from './routes/sermon.js';
import syncRouter from './routes/sync.js';
import { initializeDatabase } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (프론트엔드)
app.use(express.static('public'));

// 데이터베이스 초기화 (비동기, 실패해도 서버는 계속 실행)
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err.message);
  console.warn('Server will continue running, but database features will be unavailable.');
  console.warn('To enable database features, configure PostgreSQL connection settings.');
});

// 데이터베이스 초기화 엔드포인트 (수동 초기화용)
app.post('/api/db/init', async (req, res) => {
  try {
    await initializeDatabase();
    res.json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Manual database initialization error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Check database connection settings and ensure PostgreSQL is accessible.'
    });
  }
});

// 라우트
app.use('/api/extract', extractRouter);
app.use('/api/correct', correctRouter);
app.use('/api/process', processRouter);
app.use('/api/index', indexRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai-keys', aiKeysRouter);
app.use('/api/bible', bibleRouter);
app.use('/api/podcast', podcastRouter);
app.use('/api/image', imageRouter);
app.use('/api/sermon', sermonRouter);
app.use('/api/sync', syncRouter);

// Health check
app.get('/health', async (req, res) => {
  try {
    const { pool } = await import('./config/database.js');
    // 데이터베이스 연결 테스트
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// API 정보 엔드포인트
app.get('/api', (req, res) => {
  res.json({
    message: '안양제일교회 YouTube RAG 시스템 API',
    version: '2.0.0',
    endpoints: {
      extract: 'POST /api/extract',
      correct: 'POST /api/correct',
      process: 'POST /api/process',
      index: 'POST /api/index',
      search: 'POST /api/search',
      rag: 'POST /api/search/rag',
      aiKeys: {
        list: 'GET /api/ai-keys',
        create: 'POST /api/ai-keys',
        update: 'PUT /api/ai-keys/:id',
        delete: 'DELETE /api/ai-keys/:id'
      },
      bible: {
        search: 'POST /api/bible/search',
        saveVerse: 'POST /api/bible/verse'
      },
      podcast: {
        generate: 'POST /api/podcast/generate',
        generateLong: 'POST /api/podcast/generate-long'
      },
      image: {
        generate: 'POST /api/image/generate'
      },
      sermon: {
        search: 'POST /api/sermon/search'
      },
      sync: {
        sync: 'POST /api/sync',
        status: 'GET /api/sync/status'
      }
    }
  });
});

// 루트 경로는 index.html로 리다이렉트 (정적 파일이 없을 경우를 대비)
// express.static이 먼저 처리하므로 실제로는 index.html이 서빙됨
app.get('/', (req, res, next) => {
  // 정적 파일 미들웨어가 처리하지 못한 경우에만 실행
  // 일반적으로는 express.static이 index.html을 서빙함
  next();
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}`);
});
