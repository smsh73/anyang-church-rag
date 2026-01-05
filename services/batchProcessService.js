/**
 * 배치 처리 서비스
 * 채널/재생목록의 동영상들을 자동으로 처리하는 파이프라인
 */

import { 
  getAllChannelVideos, 
  getAllPlaylistVideos,
  extractChannelId,
  extractPlaylistId
} from '../utils/youtubeDataAPI.js';
import { extractVideoId } from '../utils/youtubeDownloader.js';
import { extractTranscript } from './youtubeService.js';
import { correctTranscript } from './correctionService.js';
import { cleanTranscript, createParagraphs } from '../utils/textCleaner.js';
import { extractMetadata } from '../utils/metadataExtractor.js';
import { chunkText } from '../utils/textChunker.js';
import { generateEmbeddings } from './embeddingService.js';
import { extractSermonMetadata } from './metadataExtractionService.js';
import { saveSermonChunk, saveSermonTranscript } from './sermonStorageService.js';

/**
 * 단일 동영상 처리
 */
async function processVideo(videoUrl, startTime = null, endTime = null, autoIndex = false) {
  try {
    const videoId = extractVideoId(videoUrl);
    console.log(`\n[${videoId}] 처리 시작...`);

    // 1. 자막 추출
    console.log(`[${videoId}] Step 1: 자막 추출...`);
    const extractResult = await extractTranscript(videoUrl, startTime, endTime);
    console.log(`[${videoId}] ✅ 자막 추출 완료 (${extractResult.transcript?.length || 0}개 세그먼트)`);

    // 2. AI 보정
    console.log(`[${videoId}] Step 2: AI 보정...`);
    const correctionResult = await correctTranscript(extractResult.transcript);
    console.log(`[${videoId}] ✅ AI 보정 완료`);

    // 3. 텍스트 정리
    console.log(`[${videoId}] Step 3: 텍스트 정리...`);
    const cleanedTranscript = cleanTranscript(correctionResult.correctedTranscript);
    console.log(`[${videoId}] ✅ 텍스트 정리 완료`);

    // 4. 문단 생성
    console.log(`[${videoId}] Step 4: 문단 생성...`);
    const paragraphs = createParagraphs(cleanedTranscript);
    const fullText = paragraphs.map(p => p.text.trim()).filter(p => p.length > 0).join('\n\n');
    console.log(`[${videoId}] ✅ 문단 생성 완료 (${paragraphs.length}개 문단)`);

    // 5. 메타데이터 추출
    console.log(`[${videoId}] Step 5: 메타데이터 추출...`);
    const videoMetadata = await extractMetadata(extractResult.videoId);
    console.log(`[${videoId}] ✅ 메타데이터 추출 완료`);

    // 6. 청킹
    console.log(`[${videoId}] Step 6: 청킹...`);
    let chunks = chunkText(paragraphs, videoMetadata, 500, 20);
    console.log(`[${videoId}] ✅ 청킹 완료 (${chunks.length}개 청크)`);

    // 7. 각 청크별 메타데이터 추출
    console.log(`[${videoId}] Step 7: 청크별 메타데이터 추출...`);
    for (let i = 0; i < chunks.length; i++) {
      const chunkMetadata = await extractSermonMetadata(chunks[i].chunkText, videoMetadata);
      chunks[i].metadata = {
        ...chunks[i].metadata,
        ...chunkMetadata
      };
      chunks[i].fullText = formatEmbeddingText(chunks[i].metadata, chunks[i].chunkText);
    }
    console.log(`[${videoId}] ✅ 청크별 메타데이터 추출 완료`);

    // 8. 벡터 임베딩 생성
    console.log(`[${videoId}] Step 8: 벡터 임베딩 생성...`);
    const chunksWithEmbeddings = await generateEmbeddings(chunks);
    console.log(`[${videoId}] ✅ 벡터 임베딩 생성 완료`);

    // 9. PostgreSQL에 저장
    console.log(`[${videoId}] Step 9: PostgreSQL 저장...`);
    const transcriptMetadata = {
      ...videoMetadata,
      ...(chunksWithEmbeddings[0]?.metadata || {})
    };
    await saveSermonTranscript(extractResult.videoId, fullText, transcriptMetadata);
    
    for (const chunk of chunksWithEmbeddings) {
      await saveSermonChunk(chunk, chunk.embedding);
    }
    console.log(`[${videoId}] ✅ PostgreSQL 저장 완료`);

    // 10. Azure AI Search 인덱싱 (선택)
    let indexed = false;
    if (autoIndex) {
      if (process.env.AZURE_SEARCH_ENDPOINT && process.env.AZURE_SEARCH_API_KEY) {
        try {
          console.log(`[${videoId}] Step 10: Azure AI Search 인덱싱...`);
          const { syncAndDeployIndex, indexDocuments } = await import('./indexService.js');
          await syncAndDeployIndex();
          await indexDocuments(chunksWithEmbeddings);
          indexed = true;
          console.log(`[${videoId}] ✅ Azure AI Search 인덱싱 완료`);
        } catch (indexError) {
          console.warn(`[${videoId}] ⚠️ Azure AI Search 인덱싱 실패: ${indexError.message}`);
        }
      }
    }

    console.log(`[${videoId}] ✅ 처리 완료!`);
    
    return {
      success: true,
      videoId: extractResult.videoId,
      videoUrl,
      method: extractResult.method,
      stats: {
        totalChunks: chunksWithEmbeddings.length,
        totalParagraphs: paragraphs.length,
        totalCharacters: fullText.length,
        indexed
      }
    };
  } catch (error) {
    let videoId = 'unknown';
    try {
      videoId = extractVideoId(videoUrl);
    } catch (e) {
      // videoId 추출 실패
    }
    console.error(`[${videoId}] ❌ 처리 실패: ${error.message}`);
    return {
      success: false,
      videoId,
      videoUrl,
      error: error.message
    };
  }
}

/**
 * 임베딩 텍스트 포맷팅
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

/**
 * 채널의 모든 동영상 처리
 */
export async function processChannel(channelUrl, options = {}) {
  const {
    keyword = null,
    maxVideos = null,
    startTime = null,
    endTime = null,
    autoIndex = false,
    delayBetweenVideos = 5000, // 동영상 간 대기 시간 (밀리초)
    onProgress = null // 진행 상황 콜백
  } = options;

  console.log(`\n=== 채널 배치 처리 시작 ===`);
  console.log(`채널 URL: ${channelUrl}`);
  if (keyword) console.log(`키워드 필터: ${keyword}`);
  if (maxVideos) console.log(`최대 동영상 수: ${maxVideos}`);
  console.log('');

  try {
    // 채널의 동영상 목록 가져오기
    console.log('채널 동영상 목록 가져오는 중...');
    const videos = await getAllChannelVideos(channelUrl, keyword, maxVideos);
    console.log(`✅ ${videos.length}개의 동영상 발견\n`);

    if (videos.length === 0) {
      return {
        success: true,
        total: 0,
        processed: 0,
        failed: 0,
        results: []
      };
    }

    // 각 동영상 처리
    const results = [];
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
      
      console.log(`\n[${i + 1}/${videos.length}] ${video.title}`);
      console.log(`게시일: ${video.publishedAt}`);

      const result = await processVideo(videoUrl, startTime, endTime, autoIndex);
      results.push({
        ...result,
        title: video.title,
        publishedAt: video.publishedAt
      });

      if (result.success) {
        processed++;
      } else {
        failed++;
      }

      // 진행 상황 콜백
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: videos.length,
          processed,
          failed,
          currentVideo: video.title
        });
      }

      // 마지막 동영상이 아니면 대기
      if (i < videos.length - 1 && delayBetweenVideos > 0) {
        console.log(`다음 동영상까지 ${delayBetweenVideos / 1000}초 대기...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenVideos));
      }
    }

    console.log(`\n=== 채널 배치 처리 완료 ===`);
    console.log(`총 동영상: ${videos.length}개`);
    console.log(`성공: ${processed}개`);
    console.log(`실패: ${failed}개`);

    return {
      success: true,
      total: videos.length,
      processed,
      failed,
      results
    };
  } catch (error) {
    console.error(`채널 배치 처리 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 재생목록의 모든 동영상 처리
 */
export async function processPlaylist(playlistUrl, options = {}) {
  const {
    keyword = null,
    maxVideos = null,
    startTime = null,
    endTime = null,
    autoIndex = false,
    delayBetweenVideos = 5000,
    onProgress = null
  } = options;

  console.log(`\n=== 재생목록 배치 처리 시작 ===`);
  console.log(`재생목록 URL: ${playlistUrl}`);
  if (keyword) console.log(`키워드 필터: ${keyword}`);
  if (maxVideos) console.log(`최대 동영상 수: ${maxVideos}`);
  console.log('');

  try {
    // 재생목록의 동영상 목록 가져오기
    console.log('재생목록 동영상 목록 가져오는 중...');
    const videos = await getAllPlaylistVideos(playlistUrl, keyword, maxVideos);
    console.log(`✅ ${videos.length}개의 동영상 발견\n`);

    if (videos.length === 0) {
      return {
        success: true,
        total: 0,
        processed: 0,
        failed: 0,
        results: []
      };
    }

    // 각 동영상 처리
    const results = [];
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
      
      console.log(`\n[${i + 1}/${videos.length}] ${video.title}`);
      console.log(`게시일: ${video.publishedAt}`);

      const result = await processVideo(videoUrl, startTime, endTime, autoIndex);
      results.push({
        ...result,
        title: video.title,
        publishedAt: video.publishedAt
      });

      if (result.success) {
        processed++;
      } else {
        failed++;
      }

      // 진행 상황 콜백
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: videos.length,
          processed,
          failed,
          currentVideo: video.title
        });
      }

      // 마지막 동영상이 아니면 대기
      if (i < videos.length - 1 && delayBetweenVideos > 0) {
        console.log(`다음 동영상까지 ${delayBetweenVideos / 1000}초 대기...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenVideos));
      }
    }

    console.log(`\n=== 재생목록 배치 처리 완료 ===`);
    console.log(`총 동영상: ${videos.length}개`);
    console.log(`성공: ${processed}개`);
    console.log(`실패: ${failed}개`);

    return {
      success: true,
      total: videos.length,
      processed,
      failed,
      results
    };
  } catch (error) {
    console.error(`재생목록 배치 처리 실패: ${error.message}`);
    throw error;
  }
}
