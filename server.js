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
import { initializeDatabase } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());

// 데이터베이스 초기화
initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 루트
app.get('/', (req, res) => {
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
      }
    }
  });
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
