import express from 'express';
import { extractTranscript } from '../services/youtubeService.js';
import { correctTranscript } from '../services/correctionService.js';
import { cleanTranscript, createParagraphs } from '../utils/textCleaner.js';
import { extractMetadata } from '../utils/metadataExtractor.js';
import { chunkText } from '../utils/textChunker.js';
import { generateEmbeddings } from '../services/embeddingService.js';
import { extractSermonMetadata } from '../services/metadataExtractionService.js';
import { saveSermonChunk, saveSermonTranscript } from '../services/sermonStorageService.js';

const router = express.Router();

/**
 * POST /api/process
 * 전체 파이프라인 실행
 */
router.post('/', async (req, res) => {
  try {
    const { url, startTime, endTime, autoIndex = false } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // 1. 자막 추출
    console.log('Step 1: Extracting transcript...');
    const extractResult = await extractTranscript(url, startTime, endTime);
    
    // 2. AI 보정
    console.log('Step 2: Correcting transcript...');
    const correctionResult = await correctTranscript(extractResult.transcript);
    
    // 3. 불필요한 요소 제거
    console.log('Step 3: Cleaning transcript...');
    const cleanedTranscript = cleanTranscript(correctionResult.correctedTranscript);
    
    // 4. 설교원문을 완전한 문단으로 만들기
    console.log('Step 4: Creating paragraphs...');
    const paragraphs = createParagraphs(cleanedTranscript);
    
    // 4-1. 전체 텍스트 생성 (문단을 이어 붙인 원문)
    // 문단들을 빈 줄로 구분하여 하나의 완전한 텍스트로 합침
    const fullText = paragraphs.map(p => p.text.trim()).filter(p => p.length > 0).join('\n\n');
    
    // 5. 비디오 메타데이터 추출
    console.log('Step 5: Extracting video metadata...');
    const videoMetadata = await extractMetadata(extractResult.videoId);
    
    // 6. 500자 청킹 (20% 오버랩)
    console.log('Step 6: Chunking text (500 chars, 20% overlap)...');
    let chunks = chunkText(paragraphs, videoMetadata, 500, 20);
    
    // 7. 각 청크별 메타데이터 추출
    console.log('Step 7: Extracting sermon metadata for each chunk...');
    for (let i = 0; i < chunks.length; i++) {
      const chunkMetadata = await extractSermonMetadata(chunks[i].chunkText, videoMetadata);
      chunks[i].metadata = {
        ...chunks[i].metadata,
        ...chunkMetadata
      };
      // fullText 업데이트 (메타데이터 포함)
      chunks[i].fullText = formatEmbeddingText(chunks[i].metadata, chunks[i].chunkText);
    }
    
    // 8. 벡터 임베딩 생성 (768차원, text-embedding-ada-002)
    console.log('Step 8: Generating embeddings (768 dimensions)...');
    const chunksWithEmbeddings = await generateEmbeddings(chunks);
    
    // 9. PostgreSQL에 저장
    console.log('Step 9: Saving to PostgreSQL...');
    
    // 9-1. 전체 텍스트 저장 (문단으로 이어 붙인 원문)
    console.log('Step 9-1: Saving full transcript text...');
    const transcriptMetadata = {
      ...videoMetadata,
      ...(chunksWithEmbeddings[0]?.metadata || {})
    };
    await saveSermonTranscript(extractResult.videoId, fullText, transcriptMetadata);
    
    // 9-2. 청크 저장
    console.log('Step 9-2: Saving chunks...');
    for (const chunk of chunksWithEmbeddings) {
      await saveSermonChunk(chunk, chunk.embedding);
    }
    
    // 10. PostgreSQL 벡터 인덱스 동기화
    console.log('Step 10: Syncing PostgreSQL vector indexes...');
    try {
      const { syncPostgreSQLIndex } = await import('../services/sermonStorageService.js');
      await syncPostgreSQLIndex();
    } catch (syncError) {
      console.warn('PostgreSQL index sync warning:', syncError.message);
      // 동기화 실패해도 계속 진행
    }
    
    // 11. Azure AI Search 인덱싱 및 배포 (선택)
    let indexStatus = null;
    if (autoIndex) {
      if (!process.env.AZURE_SEARCH_ENDPOINT || !process.env.AZURE_SEARCH_API_KEY) {
        console.log('Step 11: Azure AI Search not configured, skipping...');
        indexStatus = { error: 'Azure Search not configured' };
      } else {
        console.log('Step 11: Indexing to Azure AI Search...');
        try {
          const { createIndex, indexDocuments, syncAndDeployIndex } = await import('../services/indexService.js');
          
          // 인덱스 동기화 및 배포
          await syncAndDeployIndex();
          
          // 문서 인덱싱
          await indexDocuments(chunksWithEmbeddings);
          
          // 최종 상태 확인
          const { getIndexStatus } = await import('../services/indexService.js');
          indexStatus = await getIndexStatus();
          
          console.log('Azure AI Search indexing completed');
        } catch (indexError) {
          console.error('Indexing error:', indexError);
          indexStatus = { error: indexError.message };
          // 인덱싱 실패해도 결과는 반환
        }
      }
    }
    
    res.json({
      success: true,
      videoId: extractResult.videoId,
      method: extractResult.method,
      metadata: videoMetadata,
      chunks: chunksWithEmbeddings.map(chunk => ({
        id: chunk.id,
        chunkText: chunk.chunkText,
        fullText: chunk.fullText,
        metadata: chunk.metadata,
        hasEmbedding: !!chunk.embedding,
        embeddingDimensions: chunk.embedding?.length || 0,
        savedToPostgreSQL: true,
        indexed: autoIndex
      })),
      stats: {
        totalChunks: chunksWithEmbeddings.length,
        totalParagraphs: paragraphs.length,
        totalCharacters: fullText.length,
        embeddingModel: 'text-embedding-ada-002',
        embeddingDimensions: 768,
        fullTextSaved: true
      },
      indexStatus: indexStatus || {
        postgreSQL: 'synchronized',
        azureSearch: autoIndex ? 'pending' : 'skipped'
      }
    });
  } catch (error) {
    console.error('Process error:', error);
    console.error('Error stack:', error.stack);
    
    // 에러 타입에 따라 적절한 상태 코드 설정
    let statusCode = 500;
    let errorMessage = error.message || '처리 중 오류가 발생했습니다.';
    
    if (error.message.includes('YouTube') || error.message.includes('410') || error.message.includes('403')) {
      statusCode = 400; // 클라이언트 오류
    } else if (error.message.includes('Database') || error.message.includes('PostgreSQL')) {
      statusCode = 503; // 서비스 사용 불가
    }
    
    // 상세한 에러 정보 반환
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 임베딩 텍스트 포맷팅 헬퍼 함수
 */
function formatEmbeddingText(metadata, text) {
  const parts = [];
  
  if (metadata.preacher) {
    parts.push(`[설교자: ${metadata.preacher}]`);
  }
  if (metadata.sermon_topic) {
    parts.push(`[주제: ${metadata.sermon_topic}]`);
  }
  if (metadata.bible_verse) {
    parts.push(`[성경말씀: ${metadata.bible_verse}]`);
  }
  if (metadata.serviceDate) {
    parts.push(`[날짜: ${metadata.serviceDate}]`);
  }
  if (metadata.serviceType) {
    parts.push(`[${metadata.serviceType}]`);
  }
  if (metadata.videoTitle) {
    parts.push(`[${metadata.videoTitle}]`);
  }
  if (metadata.keywords && metadata.keywords.length > 0) {
    parts.push(`[키워드: ${metadata.keywords.join(', ')}]`);
  }
  
  return parts.join(' ') + ' ' + text;
}

export default router;
