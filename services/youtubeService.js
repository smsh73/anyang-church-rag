import { YoutubeTranscript } from 'youtube-transcript';
import { extractVideoId, downloadAudio, cleanupTempFile } from '../utils/youtubeDownloader.js';
import { transcribeAudio } from '../utils/whisperSTT.js';
import { parseTimeToSeconds } from '../utils/timeParser.js';
import { extractCaptionsWithAPI } from '../utils/youtubeDataAPI.js';

/**
 * YouTube 자막 추출 (자막 또는 STT)
 * @param {string} url - YouTube URL
 * @param {string} startTime - 시작 시간 (예: "38:40")
 * @param {string} endTime - 종료 시간 (예: "1:14:40")
 * @returns {Promise<Object>} 자막 데이터
 */
export async function extractTranscript(url, startTime = null, endTime = null) {
  const videoId = extractVideoId(url);
  const startSeconds = startTime ? parseTimeToSeconds(startTime) : null;
  const endSeconds = endTime ? parseTimeToSeconds(endTime) : null;
  
  let transcript = [];
  let method = 'caption';
  
  try {
    // 방법 1: YouTube Data API를 사용한 자막 추출 (API 키가 있는 경우)
    // YouTube Data API는 가장 안정적이므로 우선적으로 시도
    if (process.env.YOUTUBE_API_KEY) {
      console.log('Trying YouTube Data API for captions...');
      try {
        const apiTranscript = await extractCaptionsWithAPI(videoId, startSeconds, endSeconds);
        if (apiTranscript && apiTranscript.length > 0) {
          transcript = apiTranscript;
          method = 'youtube-api';
          console.log(`✅ Captions extracted via YouTube Data API: ${transcript.length} segments`);
          return {
            success: true,
            videoId,
            method,
            startTime: startSeconds,
            endTime: endSeconds,
            transcript
          };
        } else {
          console.log('YouTube Data API: No captions found or empty result');
        }
      } catch (apiError) {
        console.warn('YouTube Data API failed:', apiError.message);
        // API 실패해도 다른 방법 시도
      }
    } else {
      console.log('YouTube Data API key not set. Skipping API method.');
    }
    
    // 방법 2: youtube-transcript 라이브러리 사용
    console.log('Trying youtube-transcript library...');
    const transcriptList = await YoutubeTranscript.fetchTranscript(videoId);
    
    // 시간 구간 필터링
    transcript = transcriptList
      .map(item => ({
        text: item.text,
        offset: Math.floor(item.offset), // 밀리초
        duration: item.duration || 0
      }))
      .filter(item => {
        if (startSeconds !== null && item.offset < startSeconds * 1000) {
          return false;
        }
        if (endSeconds !== null && item.offset > endSeconds * 1000) {
          return false;
        }
        return true;
      });
    
    method = 'caption';
    console.log(`✅ Captions extracted via youtube-transcript: ${transcript.length} segments`);
  } catch (error) {
    // 자막이 없으면 STT 사용
    console.log('Caption not available, trying STT...');
    console.log('Caption error:', error.message);
    console.log('Error details:', {
      videoId,
      startSeconds,
      endSeconds,
      errorType: error.constructor.name,
      errorStack: error.stack?.substring(0, 200)
    });
    
    let audioPath = null;
    let downloadMethod = 'unknown';
    
    try {
      // 오디오 다운로드 (여러 방법 시도)
      console.log(`Attempting to download audio for video ${videoId}...`);
      
      // 오디오 다운로드: yt-dlp를 최우선으로 시도 (가장 안정적)
      const { checkYtdlpAvailable, downloadAudioWithYtdlp } = await import('../utils/youtubeDownloaderYtdlp.js');
      
      // 1. yt-dlp 우선 시도 (가장 안정적)
      const ytdlpCheck = await checkYtdlpAvailable();
      console.log(`yt-dlp available: ${ytdlpCheck.available}`);
      
      if (ytdlpCheck.available) {
        try {
          console.log('Trying yt-dlp for audio download (most reliable method)...');
          audioPath = await downloadAudioWithYtdlp(videoId, startSeconds, endSeconds);
          downloadMethod = 'yt-dlp';
          console.log(`✅ Audio downloaded via yt-dlp: ${audioPath}`);
        } catch (ytdlpError) {
          console.warn('yt-dlp failed:', ytdlpError.message);
          console.log('Falling back to ytdl-core...');
        }
      } else {
        console.log('yt-dlp not available, using ytdl-core...');
      }
      
      // 2. yt-dlp 실패 시 ytdl-core 시도
      if (!audioPath) {
        try {
          console.log('Trying ytdl-core for audio download...');
          audioPath = await downloadAudio(videoId, startSeconds, endSeconds);
          downloadMethod = 'ytdl-core';
          console.log(`✅ Audio downloaded via ytdl-core: ${audioPath}`);
        } catch (ytdlError) {
          console.error('ytdl-core failed:', ytdlError.message);
          
          // 3. ytdl-core 실패 시 yt-dlp 재시도 (가능한 경우)
          if (ytdlpCheck.available) {
            console.log('Retrying with yt-dlp as last resort...');
            try {
              audioPath = await downloadAudioWithYtdlp(videoId, startSeconds, endSeconds);
              downloadMethod = 'yt-dlp-retry';
              console.log(`✅ Audio downloaded via yt-dlp (retry): ${audioPath}`);
            } catch (retryError) {
              console.error('yt-dlp retry also failed:', retryError.message);
              throw new Error(`All download methods failed. ytdl-core: ${ytdlError.message}, yt-dlp: ${retryError.message}`);
            }
          } else {
            throw ytdlError;
          }
        }
      }
      
      if (!audioPath) {
        throw new Error('All download methods failed');
      }
      
      // STT 변환
      console.log(`Transcribing audio using Whisper (method: ${downloadMethod})...`);
      transcript = await transcribeAudio(audioPath, 'ko');
      console.log(`✅ Transcription completed: ${transcript.length} segments`);
      
      method = `stt-${downloadMethod}`;
    } catch (sttError) {
      console.error('STT error details:', {
        message: sttError.message,
        stack: sttError.stack?.substring(0, 300),
        videoId,
        downloadMethod
      });
      
      // 더 자세한 에러 메시지 제공
      let errorMessage = `자막 및 오디오 추출 실패: ${sttError.message}`;
      
      if (sttError.message.includes('410') || sttError.message.includes('Gone')) {
        errorMessage = `YouTube 비디오를 다운로드할 수 없습니다 (410 Gone). 비디오가 삭제되었거나 접근이 제한되었을 수 있습니다. (비디오 ID: ${videoId})\n\n해결 방법:\n1. YouTube Data API 키를 설정하여 자막을 직접 가져오기\n2. 비디오가 공개되어 있고 접근 가능한지 확인\n3. 다른 YouTube 비디오로 시도`;
      } else if (sttError.message.includes('403') || sttError.message.includes('Forbidden')) {
        errorMessage = `YouTube 비디오 접근이 거부되었습니다 (403 Forbidden). 비디오가 지역 제한 또는 연령 제한이 있을 수 있습니다. (비디오 ID: ${videoId})\n\n해결 방법:\n1. YouTube Data API 키를 설정하여 자막을 직접 가져오기\n2. 비디오 제한 설정 확인`;
      } else if (sttError.message.includes('404') || sttError.message.includes('Not Found')) {
        errorMessage = `YouTube 비디오를 찾을 수 없습니다 (404 Not Found). URL을 확인해주세요. (비디오 ID: ${videoId})`;
      } else if (sttError.message.includes('yt-dlp') || sttError.message.includes('ytdl')) {
        errorMessage = `YouTube 오디오 다운로드 실패: ${sttError.message}\n\n해결 방법:\n1. YouTube Data API 키를 설정하여 자막을 직접 가져오기 (권장)\n2. 비디오에 자막이 있는지 확인\n3. 서버 로그에서 상세한 오류 확인`;
      }
      
      throw new Error(errorMessage);
    } finally {
      // 임시 파일 정리
      if (audioPath) {
        await cleanupTempFile(audioPath);
      }
    }
  }
  
  return {
    success: true,
    videoId,
    method,
    startTime: startSeconds,
    endTime: endSeconds,
    transcript
  };
}
