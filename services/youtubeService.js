import { YoutubeTranscript } from 'youtube-transcript';
import { extractVideoId, downloadAudio, cleanupTempFile } from '../utils/youtubeDownloader.js';
import { transcribeAudio } from '../utils/whisperSTT.js';
import { parseTimeToSeconds } from '../utils/timeParser.js';

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
    // 먼저 자막 시도
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
  } catch (error) {
    // 자막이 없으면 STT 사용
    console.log('Caption not available, using STT...');
    
    let audioPath = null;
    try {
      // 오디오 다운로드
      audioPath = await downloadAudio(videoId, startSeconds, endSeconds);
      
      // STT 변환
      transcript = await transcribeAudio(audioPath, 'ko');
      
      method = 'stt';
    } catch (sttError) {
      throw new Error(`Failed to extract transcript: ${sttError.message}`);
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
