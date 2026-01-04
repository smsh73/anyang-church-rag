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
    if (process.env.YOUTUBE_API_KEY) {
      console.log('Trying YouTube Data API for captions...');
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
      }
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
    console.log('Caption not available, using STT...');
    console.log('Caption error:', error.message);
    
    let audioPath = null;
    try {
      // 오디오 다운로드
      console.log(`Downloading audio for video ${videoId}...`);
      audioPath = await downloadAudio(videoId, startSeconds, endSeconds);
      console.log(`Audio downloaded: ${audioPath}`);
      
      // STT 변환
      console.log('Transcribing audio...');
      transcript = await transcribeAudio(audioPath, 'ko');
      console.log(`Transcription completed: ${transcript.length} segments`);
      
      method = 'stt';
    } catch (sttError) {
      console.error('STT error:', sttError);
      // 더 자세한 에러 메시지 제공
      let errorMessage = `자막 추출 실패: ${sttError.message}`;
      
      if (sttError.message.includes('410')) {
        errorMessage = `YouTube 비디오를 다운로드할 수 없습니다. 비디오가 삭제되었거나 접근이 제한되었을 수 있습니다. (비디오 ID: ${videoId})`;
      } else if (sttError.message.includes('403')) {
        errorMessage = `YouTube 비디오 접근이 거부되었습니다. 비디오가 지역 제한 또는 연령 제한이 있을 수 있습니다. (비디오 ID: ${videoId})`;
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
