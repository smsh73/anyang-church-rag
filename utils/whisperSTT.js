import { pipeline } from '@xenova/transformers';
import fs from 'fs-extra';

let transcriber = null;

/**
 * Whisper 모델 초기화
 */
async function initializeTranscriber() {
  if (!transcriber) {
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-small',
      { device: 'cpu' }
    );
  }
  return transcriber;
}

/**
 * 오디오 파일을 텍스트로 변환
 * @param {string} audioPath - 오디오 파일 경로
 * @param {string} language - 언어 코드 (예: 'ko')
 * @returns {Promise<Array>} 타임스탬프와 텍스트 배열
 */
export async function transcribeAudio(audioPath, language = 'ko') {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }
  
  const model = await initializeTranscriber();
  
  try {
    console.log(`Transcribing audio file: ${audioPath}`);
    
    // @xenova/transformers는 파일 경로를 직접 지원합니다
    // 하지만 오디오 형식이 올바른지 확인 필요
    const result = await model(audioPath, {
      language: language,
      return_timestamps: true,
      chunk_length_s: 30,  // 30초 청크로 처리
      stride_length_s: 5   // 5초 오버랩
    });
    
    console.log(`Transcription result type: ${typeof result}`);
    console.log(`Has chunks: ${!!result.chunks}`);
    console.log(`Has text: ${!!result.text}`);
    
    // 결과를 표준 형식으로 변환
    const transcript = [];
    
    if (result.chunks && Array.isArray(result.chunks) && result.chunks.length > 0) {
      // chunks가 있는 경우 (타임스탬프 포함)
      for (const chunk of result.chunks) {
        if (chunk.text && chunk.text.trim()) {
          const startTime = chunk.timestamp ? chunk.timestamp[0] : 0;
          const endTime = chunk.timestamp ? chunk.timestamp[1] : 0;
          
          transcript.push({
            text: chunk.text.trim(),
            offset: Math.floor(startTime * 1000), // 초를 밀리초로 변환
            duration: Math.floor((endTime - startTime) * 1000)
          });
        }
      }
    } else if (result.text) {
      // chunks가 없지만 text가 있는 경우
      // 전체 텍스트를 하나의 세그먼트로 처리
      const text = result.text.trim();
      if (text) {
        transcript.push({
          text: text,
          offset: 0,
          duration: 0  // duration은 알 수 없음
        });
      }
    } else {
      // 결과가 예상과 다른 형식인 경우
      console.warn('Unexpected transcription result format:', JSON.stringify(result).substring(0, 200));
      throw new Error('Transcription result format is not supported');
    }
    
    if (transcript.length === 0) {
      throw new Error('No transcript segments generated from audio');
    }
    
    console.log(`Transcription completed: ${transcript.length} segments`);
    return transcript;
  } catch (error) {
    console.error('Transcription error details:', error);
    throw new Error(`Transcription failed: ${error.message}`);
  }
}
